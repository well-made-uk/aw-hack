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
 * Integer BPMs within ±tolerance% of `bpm`.
 * @param {number} bpm
 * @param {number} tolerance percent
 */
export function mixableBpms(bpm, tolerance = 6) {
	const out = [];
	for (let b = Math.ceil(bpm * (1 - tolerance / 100)); b <= Math.floor(bpm * (1 + tolerance / 100)); b++) out.push(String(b));
	return out;
}

/**
 * Energy levels (1-10) to allow next: same keeps it within one level, up lifts it, down drops it.
 * @param {number | undefined} level the playing track's energy
 * @param {'down' | 'same' | 'up' | 'any'} energy
 */
export function energyLevels(level, energy) {
	if (!level || energy === 'any') return null;
	const [lo, hi] = energy === 'up' ? [level + 1, 10] : energy === 'down' ? [1, level - 1] : [level - 1, level + 1];
	const out = [];
	for (let l = Math.max(1, lo); l <= Math.min(10, hi); l++) out.push(String(l));
	return out;
}

/**
 * Angle in degrees (0 = top, clockwise) of a Camelot number's slice centre.
 * @param {string} code
 */
export function keyAngle(code) {
	return (parseInt(code, 10) - 1) * 30;
}
