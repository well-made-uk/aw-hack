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
import { compatibleKeys, energyLevels, mixableBpms } from '#lib/camelot.js';
import { demoTracks } from './demo.js';

/**
 * @typedef {{ title: string, artist: string, genre?: string, bpm: number, camelot: string, key?: string, duration?: number, energy?: number, peak_at?: number, file?: string }} TrackMeta
 * @typedef {{ id: string, embeddings: number[], metadata: TrackMeta }} StoredTrack
 * @typedef {TrackMeta & { id: string, sig: number[] }} Track
 * @typedef {{ tolerance?: number, keyMode?: 'strict' | 'loose' | 'any', energy?: string, limit?: number }} NextOptions
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
 * 16-number summaries of each fingerprint, used to draw label art. Each number is the vector's
 * projection onto a fixed random direction, ranked across the whole crate and spread over -1..1.
 * Ranking uses the full range evenly (so labels vary a lot), while tracks that sound alike still
 * land close together (so they look alike).
 * @param {StoredTrack[]} tracks
 */
function signatures(tracks) {
	const dim = tracks[0]?.embeddings.length ?? 0;
	// Seeded PRNG (mulberry32), so labels stay the same between runs.
	let seed = 0x5eed;
	const rand = () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296 - 0.5;
	};
	const dirs = Array.from({ length: 16 }, () => Array.from({ length: dim }, rand));
	const proj = tracks.map((t) => dirs.map((d) => d.reduce((sum, v, i) => sum + v * t.embeddings[i], 0)));
	const ranked = proj.map(() => /** @type {number[]} */ ([]));
	for (let k = 0; k < 16; k++) {
		const order = proj.map((p, i) => [p[k], i]).sort((a, b) => a[0] - b[0]);
		order.forEach(([, i], rank) => (ranked[i][k] = tracks.length > 1 ? (rank / (tracks.length - 1)) * 2 - 1 : 0));
	}
	return new Map(tracks.map((t, i) => [t.id, ranked[i]]));
}

/** @param {StoredTrack} t @returns {Track} */
function toTrack(t) {
	const { file, ...meta } = t.metadata; // file paths stay on the server
	return { id: t.id, ...meta, sig: cache?.sigs.get(t.id) ?? Array(16).fill(0) };
}

/** @param {any} doc @returns {StoredTrack} */
function fromDoc(doc) {
	return { id: doc.$id, embeddings: doc.embeddings, metadata: doc.metadata };
}

/** @type {{ at: number, tracks: StoredTrack[], sigs: Map<string, number[]> } | null} */
let cache = null;

/** All tracks, cached for five minutes. @returns {Promise<StoredTrack[]>} */
async function allStored() {
	if (cache && Date.now() - cache.at < 300_000) return cache.tracks;
	let tracks;
	if (!vectorsDB) {
		tracks = demoTracks();
	} else {
		// First page tells us the total; fetch the rest in parallel.
		const db = vectorsDB;
		const page = (/** @type {number} */ offset) =>
			db.listDocuments({ ...ids, queries: [Query.limit(100), Query.offset(offset)] });
		const first = await page(0);
		const rest = await Promise.all(
			Array.from({ length: Math.ceil(first.total / 100) - 1 }, (_, i) => page((i + 1) * 100))
		);
		tracks = [first, ...rest].flatMap((r) => r.documents.map(fromDoc));
	}
	cache = { at: Date.now(), tracks, sigs: signatures(tracks) };
	return tracks;
}

/**
 * One stored track, including its file path relative to MUSIC_DIR. Falls back to
 * VectorsDB when the track was uploaded after the list was cached.
 * @param {string} id
 */
export async function getStored(id) {
	const cached = (await allStored()).find((t) => t.id === id);
	if (cached || !vectorsDB) return cached ?? null;
	try {
		return fromDoc(await vectorsDB.getDocument({ ...ids, documentId: id }));
	} catch {
		return null;
	}
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
export async function nextTracks(id, { tolerance = 6, keyMode = 'loose', energy = '1-10', limit = 20 } = {}) {
	const stored = await allStored();
	const playing = await getStored(id);
	if (!playing) return null;

	const keys = compatibleKeys(playing.metadata.camelot, keyMode);
	const bpms = mixableBpms(playing.metadata.bpm, tolerance);
	const levels = energyLevels(energy);

	/** @type {{ track: StoredTrack, distance: number }[]} */
	let results;
	if (vectorsDB) {
		const queries = [
			Query.vectorCosine('embeddings', playing.embeddings),
			Query.notEqual('$id', id),
			Query.limit(limit)
		];
		queries.push(Query.equal('metadata.bpm_int', bpms));
		if (keys) queries.push(Query.equal('metadata.camelot', keys));
		if (levels) queries.push(Query.equal('metadata.energy_level', levels));
		// createQuery sends queries in the body; a 512-d vector is too long for listDocuments' URL.
		const { documents } = await vectorsDB.createQuery({ ...ids, queries });
		results = documents.map((doc) => ({ track: fromDoc(doc), distance: doc.$distance }));
	} else {
		results = stored
			.filter((t) => t.id !== id)
			.filter((t) => bpms.includes(String(Math.round(t.metadata.bpm))))
			.filter((t) => !keys || keys.includes(t.metadata.camelot))
			.filter((t) => !levels || levels.includes(String(t.metadata.energy)))
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
