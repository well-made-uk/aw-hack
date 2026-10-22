<script>
	// Record-label artwork generated from a track's sound fingerprint (its 16-number summary).
	// Every shape and colour comes from the fingerprint, so tracks that sound alike look alike.

	/** @type {{ sig: number[], r?: number }} */
	let { sig, r = 40 } = $props();

	// Squash each value into -1..1. Raw values are small (~±0.05) because vectors are unit length.
	const t = $derived(sig.map((v) => Math.tanh(v * 25)));

	const hue = $derived(((t[0] + 1) * 180 + t[1] * 60 + 360) % 360);
	const hue2 = $derived((hue + 140 + t[2] * 60) % 360);
	const petals = $derived(3 + Math.round((t[3] + 1) * 3));
	const petalLen = $derived(r * (0.55 + 0.25 * t[4]));
	const spin = $derived(t[5] * 180);
	const rings = $derived(1 + Math.round((t[6] + 1) * 1.5));
	const dots = $derived(6 + Math.round((t[7] + 1) * 4));
	const dotR = $derived(r * (0.72 + 0.12 * t[8]));
	const core = $derived(t[9] < -0.33 ? 'circle' : t[9] < 0.33 ? 'square' : 'star');
	const wobble = $derived(0.35 + 0.25 * t[10]);

	/** @param {number} n @param {number} outer @param {number} inner */
	function star(n, outer, inner) {
		const pts = [];
		for (let i = 0; i < n * 2; i++) {
			const a = (Math.PI * i) / n - Math.PI / 2;
			const rad = i % 2 ? inner : outer;
			pts.push(`${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`);
		}
		return pts.join(' ');
	}
</script>

<g>
	<circle {r} fill="hsl({hue} 85% 62%)" />
	{#each Array(rings) as _, i}
		<circle
			r={r * (0.92 - i * 0.12)}
			fill="none"
			stroke="hsl({hue2} 70% 30%)"
			stroke-width={r * 0.025}
			stroke-dasharray={i % 2 ? `${r * 0.08} ${r * 0.06}` : 'none'}
		/>
	{/each}
	<g transform="rotate({spin})">
		{#each Array(petals) as _, i}
			<ellipse
				cx="0"
				cy={-petalLen / 2}
				rx={petalLen * wobble * 0.5}
				ry={petalLen / 2}
				fill="hsl({hue2} 90% 70%)"
				stroke="#1a1423"
				stroke-width={r * 0.02}
				transform="rotate({(360 / petals) * i})"
			/>
		{/each}
	</g>
	{#each Array(dots) as _, i}
		{@const a = ((Math.PI * 2) / dots) * i}
		<circle cx={Math.cos(a) * dotR} cy={Math.sin(a) * dotR} r={r * 0.045} fill="#1a1423" />
	{/each}
	{#if core === 'circle'}
		<circle r={r * 0.22} fill="#fff6e9" stroke="#1a1423" stroke-width={r * 0.03} />
	{:else if core === 'square'}
		<rect
			x={-r * 0.18}
			y={-r * 0.18}
			width={r * 0.36}
			height={r * 0.36}
			rx={r * 0.05}
			fill="#fff6e9"
			stroke="#1a1423"
			stroke-width={r * 0.03}
			transform="rotate({spin / 2})"
		/>
	{:else}
		<polygon points={star(5, r * 0.26, r * 0.12)} fill="#fff6e9" stroke="#1a1423" stroke-width={r * 0.03} />
	{/if}
	<!-- spindle hole -->
	<circle r={r * 0.06} fill="#1a1423" />
</g>
