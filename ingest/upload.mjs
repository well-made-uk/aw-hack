// Upload out/tracks.jsonl (from analyse.py) into the VectorsDB "tracks" collection.
// Re-running is safe: documents are keyed by a stable per-file ID and updated if they exist.
//
// Usage: node upload.mjs ../out/tracks.jsonl

import { readFileSync } from 'node:fs';
import { Client, VectorsDB } from 'node-appwrite';

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, VECTORS_DATABASE_ID, TRACKS_COLLECTION_ID } =
	process.env;

const client = new Client()
	.setEndpoint(APPWRITE_ENDPOINT)
	.setProject(APPWRITE_PROJECT_ID)
	.setKey(APPWRITE_API_KEY);
const vectorsDB = new VectorsDB(client);

const file = process.argv[2] ?? '../out/tracks.jsonl';
const tracks = readFileSync(file, 'utf8')
	.split('\n')
	.filter(Boolean)
	.map((line) => JSON.parse(line));

const ids = { databaseId: VECTORS_DATABASE_ID, collectionId: TRACKS_COLLECTION_ID };
let created = 0;
let updated = 0;

for (const track of tracks) {
	const data = { embeddings: track.embeddings, metadata: track.metadata };
	try {
		await vectorsDB.createDocument({ ...ids, documentId: track.id, data });
		created++;
	} catch (err) {
		if (err.code !== 409) {
			console.error(`Failed: ${track.metadata.title}: ${err.message}`);
			continue;
		}
		await vectorsDB.updateDocument({ ...ids, documentId: track.id, data });
		updated++;
	}
}

console.log(`Done: ${created} created, ${updated} updated, ${tracks.length} total.`);
