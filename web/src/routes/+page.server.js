import { MUSIC_DIR } from '$app/env/private';
import { listTracks, source } from '#lib/server/tracks.js';

export async function load() {
	return { tracks: await listTracks(), source, previews: Boolean(MUSIC_DIR) };
}
