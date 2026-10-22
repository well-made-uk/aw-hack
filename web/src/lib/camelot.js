// Camelot wheel helpers, shared by the server query and the wheel UI.

/** @param {number} n */
const wrap = (n) => ((n + 11) % 12) + 1;

/**
 * Keys you can mix into from `code`.
 * strict: same key or relative major/minor. loose: also ±1 on the wheel. any: everything.
 * @param {string} code e.g. "8A"
 * @param {'strict' | 'loose' | 'any'} mode
 */
export function compatibleKeys(code, mode = 'loose') {
	if (mode === 'any') return null;
	const n = parseInt(code, 10);
	const letter = code.slice(-1);
	const keys = [code, `${n}${letter === 'A' ? 'B' : 'A'}`];
	if (mode === 'loose') keys.push(`${wrap(n - 1)}${letter}`, `${wrap(n + 1)}${letter}`);
	return keys;
}

/**
 * Integer BPMs within ±tolerance% of `bpm`, optionally only up or down (energy).
 * @param {number} bpm
 * @param {number} tolerance percent
 * @param {'down' | 'any' | 'up'} energy
 */
export function mixableBpms(bpm, tolerance = 6, energy = 'any') {
	const lo = energy === 'up' ? Math.round(bpm) : Math.ceil(bpm * (1 - tolerance / 100));
	const hi = energy === 'down' ? Math.round(bpm) : Math.floor(bpm * (1 + tolerance / 100));
	const out = [];
	for (let b = lo; b <= hi; b++) out.push(String(b));
	return out;
}

/**
 * Angle in degrees (0 = top, clockwise) of a Camelot number's slice centre.
 * @param {string} code
 */
export function keyAngle(code) {
	return (parseInt(code, 10) - 1) * 30;
}
