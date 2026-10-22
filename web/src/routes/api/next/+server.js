import { error, json } from '@sveltejs/kit';
import { nextTracks } from '#lib/server/tracks.js';

export async function GET({ url }) {
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing id');

	const keyMode = /** @type {any} */ (url.searchParams.get('keys') ?? 'loose');
	const energy = url.searchParams.get('energy') ?? '1-10';
	const tolerance = Number(url.searchParams.get('tol') ?? 6);

	const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20));
	const result = await nextTracks(id, { keyMode, energy, tolerance, limit });
	if (!result) error(404, 'Track not found');
	return json(result);
}
