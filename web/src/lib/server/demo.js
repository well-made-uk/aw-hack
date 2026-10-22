// Generated stand-in tracks for when no Appwrite credentials are set.
// Vectors are clustered by "genre" and centred + normalised like real uploads.

const GENRES = [
	{ name: 'Tech House', bpm: 127, keys: ['8A', '9A', '7A', '6A', '10A'] },
	{ name: 'Minimal', bpm: 125, keys: ['5A', '4A', '6A', '8A'] },
	{ name: 'UK Garage', bpm: 132, keys: ['11A', '12A', '1A', '2B'] },
	{ name: 'Deep House', bpm: 122, keys: ['3A', '4B', '2A', '8B'] },
	{ name: 'Bass', bpm: 128, keys: ['9A', '10A', '5A', '12A'] }
];
const WORDS = ['Night', 'Shift', 'Velvet', 'Low', 'Signal', 'Pressure', 'Glow', 'Concrete', 'Haze', 'Pulse', 'Loop', 'Static', 'Orbit', 'Bounce', 'Drift', 'Echo', 'Heat', 'Tide', 'Grain', 'Riot'];
const ARTISTS = ['Demo Unit', 'Placeholder', 'Sample Rate', 'Test Pressing', 'White Label', 'Dub Plate', 'Promo Copy'];

/**
 * Small deterministic PRNG so the demo crate is the same every run.
 * @param {number} seed
 */
function rng(seed) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
}

/** @param {() => number} rand */
const gauss = (rand) => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

/** @returns {import('./tracks.js').StoredTrack[]} */
export function demoTracks() {
	const rand = rng(42);
	const dim = 512;
	const centroids = GENRES.map(() => Array.from({ length: dim }, () => gauss(rand)));
	const tracks = [];
	for (let i = 0; i < 60; i++) {
		const g = i % GENRES.length;
		const genre = GENRES[g];
		const vec = centroids[g].map((c) => c + gauss(rand) * 0.9);
		const norm = Math.hypot(...vec);
		const bpm = genre.bpm + Math.round((rand() - 0.5) * 8);
		tracks.push({
			id: `demo${String(i).padStart(3, '0')}`,
			embeddings: vec.map((v) => v / norm),
			metadata: {
				title: `${WORDS[Math.floor(rand() * WORDS.length)]} ${WORDS[Math.floor(rand() * WORDS.length)]}`,
				artist: ARTISTS[Math.floor(rand() * ARTISTS.length)],
				genre: genre.name,
				bpm,
				camelot: genre.keys[Math.floor(rand() * genre.keys.length)],
				duration: 300 + Math.round(rand() * 180)
			}
		});
	}
	return tracks;
}
