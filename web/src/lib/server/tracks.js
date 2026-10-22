// Track data, served from Appwrite VectorsDB. VectorsDB does the "what's next?" ranking:
// one vectorCosine query on the playing track's embedding, filtered by mixable BPM and key.
//
// Without Appwrite credentials (e.g. a fresh clone), falls back to generated demo tracks
// and ranks them in memory, so the UI can still be developed and shown.

import {
	APPWRITE_ENDPOINT,
	APPWRITE_PROJECT_ID,
	APPWRITE_API_KEY,
	VECTORS_DATABASE_ID,
	TRACKS_COLLECTION_ID
} from '$app/env/private';
import { Client, Query, VectorsDB } from 'node-appwrite';
import { compatibleKeys, mixableBpms } from '#lib/camelot.js';
import { demoTracks } from './demo.js';

/**
 * @typedef {{ title: string, artist: string, genre?: string, bpm: number, camelot: string, key?: string, duration?: number }} TrackMeta
 * @typedef {{ id: string, embeddings: number[], metadata: TrackMeta }} StoredTrack
 * @typedef {TrackMeta & { id: string, sig: number[] }} Track
 * @typedef {{ tolerance?: number, keyMode?: 'strict' | 'loose' | 'any', energy?: 'down' | 'any' | 'up', limit?: number }} NextOptions
 */

const live = Boolean(APPWRITE_PROJECT_ID && APPWRITE_API_KEY);
const ids = { databaseId: VECTORS_DATABASE_ID, collectionId: TRACKS_COLLECTION_ID };

/** @type {VectorsDB | null} */
let vectorsDB = null;
if (live) {
	const client = new Client()
		.setEndpoint(APPWRITE_ENDPOINT)
		.setProject(/** @type {string} */ (APPWRITE_PROJECT_ID))
		.setKey(/** @type {string} */ (APPWRITE_API_KEY));
	vectorsDB = new VectorsDB(client);
}

export const source = live ? 'vectorsdb' : 'demo';

/**
 * A 16-number summary of the 512-d fingerprint, used to draw each track's label art.
 * Averaging fixed chunks keeps it stable: tracks that sound alike get similar art.
 * @param {number[]} vec
 */
function signature(vec) {
	const size = vec.length / 16;
	const sig = [];
	for (let i = 0; i < 16; i++) {
		let sum = 0;
		for (let j = i * size; j < (i + 1) * size; j++) sum += vec[j];
		sig.push(sum / Math.sqrt(size));
	}
	return sig;
}

/** @param {StoredTrack} t @returns {Track} */
function toTrack(t) {
	return { id: t.id, ...t.metadata, sig: signature(t.embeddings) };
}

/** @param {any} doc @returns {StoredTrack} */
function fromDoc(doc) {
	return { id: doc.$id, embeddings: doc.embeddings, metadata: doc.metadata };
}

/** @type {{ at: number, tracks: StoredTrack[] } | null} */
let cache = null;

/** All tracks, cached for a minute. @returns {Promise<StoredTrack[]>} */
async function allStored() {
	if (cache && Date.now() - cache.at < 60_000) return cache.tracks;
	let tracks;
	if (!vectorsDB) {
		tracks = demoTracks();
	} else {
		tracks = [];
		/** @type {string | undefined} */
		let cursor;
		while (true) {
			const queries = [Query.limit(100)];
			if (cursor) queries.push(Query.cursorAfter(cursor));
			const { documents } = await vectorsDB.listDocuments({ ...ids, queries });
			tracks.push(...documents.map(fromDoc));
			if (documents.length < 100) break;
			cursor = documents[documents.length - 1].$id;
		}
	}
	cache = { at: Date.now(), tracks };
	return tracks;
}

export async function listTracks() {
	const tracks = await allStored();
	return tracks.map(toTrack).sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Suggestions for what to play after `id`, closest-sounding first.
 * @param {string} id
 * @param {NextOptions} opts
 */
export async function nextTracks(id, { tolerance = 6, keyMode = 'loose', energy = 'any', limit = 12 } = {}) {
	const stored = await allStored();
	const playing = stored.find((t) => t.id === id);
	if (!playing) return null;

	const keys = compatibleKeys(playing.metadata.camelot, keyMode);
	const bpms = mixableBpms(playing.metadata.bpm, tolerance, energy);

	/** @type {{ track: StoredTrack, distance: number }[]} */
	let results;
	if (vectorsDB) {
		const queries = [
			Query.vectorCosine('embeddings', playing.embeddings),
			Query.notEqual('$id', id),
			Query.equal('metadata.bpm_int', bpms),
			Query.limit(limit)
		];
		if (keys) queries.push(Query.equal('metadata.camelot', keys));
		// createQuery sends queries in the body; a 512-d vector is too long for listDocuments' URL.
		const { documents } = await vectorsDB.createQuery({ ...ids, queries });
		results = documents.map((doc) => ({ track: fromDoc(doc), distance: doc.$distance }));
	} else {
		results = stored
			.filter((t) => t.id !== id)
			.filter((t) => bpms.includes(String(Math.round(t.metadata.bpm))))
			.filter((t) => !keys || keys.includes(t.metadata.camelot))
			.map((t) => ({ track: t, distance: 1 - dot(t.embeddings, playing.embeddings) }))
			.sort((a, b) => a.distance - b.distance)
			.slice(0, limit);
	}

	return {
		playing: toTrack(playing),
		suggestions: results.map(({ track, distance }) => ({
			...toTrack(track),
			// Cosine distance is 0..2 on centred vectors, so map it onto 0..1.
			match: Math.max(0, Math.min(1, 1 - distance / 2))
		}))
	};
}

/** @param {number[]} a @param {number[]} b */
function dot(a, b) {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}
