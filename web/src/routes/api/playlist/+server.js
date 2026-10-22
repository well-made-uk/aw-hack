import { resolve } from 'node:path';
import { error } from '@sveltejs/kit';
import { MUSIC_DIR } from '$app/env/private';
import { getStored } from '#lib/server/tracks.js';

// The set as an .m3u8 playlist pointing at your own files, for importing into Rekordbox, Serato or Traktor.
export async function GET({ url }) {
	if (!MUSIC_DIR) error(404, 'Playlists need MUSIC_DIR');
	const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 500);
	const root = resolve(MUSIC_DIR);
	const lines = ['#EXTM3U'];
	for (const id of ids) {
		const track = await getStored(id);
		if (!track?.metadata.file) continue;
		const { title, artist, duration } = track.metadata;
		lines.push(`#EXTINF:${Math.round(duration ?? -1)},${artist ? `${artist} - ` : ''}${title}`);
		lines.push(resolve(root, track.metadata.file));
	}
	return new Response(lines.join('\n') + '\n', {
		headers: {
			'Content-Type': 'audio/x-mpegurl; charset=utf-8',
			'Content-Disposition': 'attachment; filename="next-track-set.m3u8"'
		}
	});
}
