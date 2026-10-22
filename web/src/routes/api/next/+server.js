import { error, json } from '@sveltejs/kit';
import { nextTracks } from '#lib/server/tracks.js';

export async function GET({ url }) {
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing id');

	const keyMode = /** @type {any} */ (url.searchParams.get('keys') ?? 'loose');
	const energy = /** @type {any} */ (url.searchParams.get('energy') ?? 'any');
	const tolerance = Number(url.searchParams.get('tol') ?? 6);

	const unfiltered = url.searchParams.has('all');
	const result = await nextTracks(id, unfiltered ? { unfiltered, limit: 100 } : { keyMode, energy, tolerance, limit: 20 });
	if (!result) error(404, 'Track not found');
	return json(result);
}
