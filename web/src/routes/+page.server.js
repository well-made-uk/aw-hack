import { listTracks, source } from '#lib/server/tracks.js';

export async function load() {
	return { tracks: await listTracks(), source };
}
