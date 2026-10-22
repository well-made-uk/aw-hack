import { MUSIC_DIR } from '$app/env/private';
import { listTracks, source } from '#lib/server/tracks.js';

export function load() {
	// Not awaited: the page renders straight away with a loader, and the crate streams in.
	return { tracks: listTracks(), source, previews: Boolean(MUSIC_DIR) };
}
