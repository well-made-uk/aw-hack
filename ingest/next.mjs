// Ask VectorsDB "what should I play after this?" from the command line.
// Finds the track by title in out/tracks.jsonl, then queries VectorsDB with its stored
// vector, filtered to a mixable BPM (±6%) and a Camelot-compatible key.
//
// Usage: node next.mjs "backstrap"            # filtered suggestions
//        node next.mjs "backstrap" --any      # pure "sounds like", no BPM/key filter

import { readFileSync } from 'node:fs';
import { Client, Query, VectorsDB } from 'node-appwrite';

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, VECTORS_DATABASE_ID, TRACKS_COLLECTION_ID } =
	process.env;

const client = new Client()
	.setEndpoint(APPWRITE_ENDPOINT)
	.setProject(APPWRITE_PROJECT_ID)
	.setKey(APPWRITE_API_KEY);
const vectorsDB = new VectorsDB(client);
const ids = { databaseId: VECTORS_DATABASE_ID, collectionId: TRACKS_COLLECTION_ID };

const [search, ...flags] = process.argv.slice(2);
if (!search) {
	console.error('Usage: node next.mjs "<part of a title>" [--any]');
	process.exit(1);
}

const local = readFileSync('../out/tracks.jsonl', 'utf8')
	.split('\n')
	.filter(Boolean)
	.map((line) => JSON.parse(line));
const match = local.find((t) => t.metadata.title.toLowerCase().includes(search.toLowerCase()));
if (!match) {
	console.error(`No track with "${search}" in its title.`);
	process.exit(1);
}

// Use the vector stored in VectorsDB (centred at upload), not the raw local one.
const playing = await vectorsDB.getDocument({ ...ids, documentId: match.id });
const { title, artist, bpm, camelot } = playing.metadata;
console.log(`\nNow playing: ${title} – ${artist}  [${bpm} BPM, ${camelot}]\n`);

// Same number, ±1 on the wheel, or the relative major/minor.
function compatibleKeys(code) {
	const n = parseInt(code, 10);
	const letter = code.slice(-1);
	const wrap = (x) => ((x + 11) % 12) + 1;
	return [code, `${wrap(n - 1)}${letter}`, `${wrap(n + 1)}${letter}`, `${n}${letter === 'A' ? 'B' : 'A'}`];
}

function mixableBpms(value) {
	const out = [];
	for (let b = Math.ceil(value * 0.94); b <= Math.floor(value * 1.06); b++) out.push(String(b));
	return out;
}

const queries = [Query.vectorCosine('embeddings', playing.embeddings), Query.notEqual('$id', playing.$id), Query.limit(10)];
if (!flags.includes('--any')) {
	queries.push(Query.equal('metadata.camelot', compatibleKeys(camelot)));
	queries.push(Query.equal('metadata.bpm_int', mixableBpms(bpm)));
}

// createQuery sends queries in the body; a 512-d vector is too long for listDocuments' URL.
const { documents } = await vectorsDB.createQuery({ ...ids, queries });
if (!documents.length) console.log('No matches. Try --any to drop the BPM/key filter.');
for (const doc of documents) {
	const m = doc.metadata;
	const pct = Math.round((1 - doc.$distance / 2) * 100);
	console.log(`${String(pct).padStart(4)}%  ${m.title} – ${m.artist}  [${m.bpm} BPM, ${m.camelot}]`);
}
console.log();
