import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { MUSIC_DIR } from '$app/env/private';
import { getStored } from '#lib/server/tracks.js';

const TYPES = {
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.flac': 'audio/flac',
	'.wav': 'audio/wav',
	'.aif': 'audio/aiff',
	'.aiff': 'audio/aiff',
	'.ogg': 'audio/ogg'
};

// Streams a track from your own music folder, with Range support so the player can seek.
export async function GET({ params, request }) {
	if (!MUSIC_DIR) error(404, 'Previews need MUSIC_DIR');
	const track = await getStored(params.id);
	if (!track?.metadata.file) error(404, 'Track not found');

	const root = resolve(MUSIC_DIR);
	const path = resolve(root, track.metadata.file);
	if (!path.startsWith(root + sep)) error(400, 'Bad path');

	const { size } = await stat(path).catch(() => error(404, 'File not found'));
	const headers = {
		'Content-Type': TYPES[/** @type {keyof TYPES} */ (extname(path).toLowerCase())] ?? 'application/octet-stream',
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'private, max-age=3600'
	};

	const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') ?? '');
	if (!range) {
		const body = /** @type {ReadableStream} */ (Readable.toWeb(createReadStream(path)));
		return new Response(body, { headers: { ...headers, 'Content-Length': String(size) } });
	}

	const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
	const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
	if (start >= size) error(416, 'Range not satisfiable');
	const body = /** @type {ReadableStream} */ (Readable.toWeb(createReadStream(path, { start, end })));
	return new Response(body, {
		status: 206,
		headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` }
	});
}
