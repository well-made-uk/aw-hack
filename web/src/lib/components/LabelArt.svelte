<script>
	// Record-label artwork generated from a track's sound fingerprint (its 16-number summary),
	// its energy and its key. The palette and layout come from the fingerprint, so tracks that
	// sound alike look alike; energy sets how busy and bright the label is; the key is printed on it.

	/** @type {{ sig: number[], r?: number, energy?: number, keyCode?: string }} */
	let { sig, r = 40, energy, keyCode = '' } = $props();

	const uid = $props.id();

	// Moody pressings: [label, ink, accent]. Dark grounds with one strong colour each.
	const PALETTES = [
		['#1d2b3a', '#e0a458', '#f4e9d6'], // midnight + amber
		['#2b1d2f', '#c8553d', '#f2d0a4'], // plum + rust
		['#0f3b3a', '#e9c46a', '#f1faee'], // deep teal + mustard
		['#3a0f1e', '#ff6f59', '#ffd6c9'], // oxblood + coral
		['#14213d', '#7aa2f7', '#e5e5e5'], // navy + periwinkle
		['#232323', '#d7263d', '#f5f3ee'], // charcoal + red
		['#203a2b', '#a7c957', '#f2e8cf'], // forest + lime
		['#2d1e4f', '#f78fb3', '#fde2e4'], // indigo + pink
		['#3d2c1e', '#e76f51', '#f4a261'], // cocoa + terracotta
		['#101820', '#00b4d8', '#caf0f8'], // ink + cyan
		['#4a1942', '#ffbe0b', '#f8edeb'], // aubergine + gold
		['#e9e4d8', '#1b263b', '#c1121f'] // cream promo: navy + red
	];
	const STYLES = ['rings', 'split', 'rays', 'bloom', 'stripes', 'dots', 'arcs', 'type'];

	// Each value is already spread over -1..1 across the crate.
	const t = $derived(sig);
	/** Map -1..1 to an index in 0..n-1. */
	const pick = (/** @type {number} */ v, /** @type {number} */ n) => Math.min(n - 1, Math.floor(((v + 1) / 2) * n));

	const palette = $derived(PALETTES[pick(t[0], PALETTES.length)]);
	const style = $derived(STYLES[pick(t[1], STYLES.length)]);
	// Energy 1-10 (or a neutral 5): quieter tracks get calmer, dimmer labels.
	const e = $derived((energy ?? 5) / 10);
	const bg = $derived(palette[0]);
	const ink = $derived(`color-mix(in oklab, ${palette[1]} ${Math.round(55 + e * 45)}%, ${palette[0]})`);
	const accent = $derived(palette[2]);
	const spin = $derived(t[5] * 180);
	const count = $derived(Math.round(4 + e * 10 + t[6] * 3));

	/** SVG path for a ring segment from a0 to a1 degrees. */
	function arc(/** @type {number} */ a0, /** @type {number} */ a1, /** @type {number} */ rad) {
		const p = (/** @type {number} */ a) => `${(Math.cos((a * Math.PI) / 180) * rad).toFixed(2)},${(Math.sin((a * Math.PI) / 180) * rad).toFixed(2)}`;
		return `M${p(a0)} A${rad},${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
	}
</script>

<g>
	<defs>
		<clipPath id="label-{uid}"><circle {r} /></clipPath>
	</defs>
	<circle {r} fill={bg} />
	<g clip-path="url(#label-{uid})" transform="rotate({spin})">
		{#if style === 'rings'}
			{#each Array(Math.max(2, Math.round(count / 3))) as _, i}
				<circle r={r * (0.95 - i * 0.17)} fill="none" style="stroke:{i % 2 ? accent : ink}" stroke-width={r * (0.05 + 0.04 * Math.abs(t[7]))} />
			{/each}
		{:else if style === 'split'}
			<rect x={-r} y={-r * (1 + t[7] * 0.4)} width={r * 2} height={r} style="fill:{ink}" />
			<rect x={-r} y={-r * 0.06} width={r * 2} height={r * 0.12} fill={accent} transform="translate(0 {-r * t[7] * 0.4})" />
		{:else if style === 'rays'}
			{#each Array(count + 4) as _, i}
				<path d="M0,0 L{r * 1.2},{-r * 0.12} L{r * 1.2},{r * 0.12}Z" style="fill:{i % 3 === 0 ? accent : ink}" transform="rotate({(360 / (count + 4)) * i})" />
			{/each}
		{:else if style === 'bloom'}
			{#each Array(Math.max(4, Math.round(count / 2))) as _, i}
				<ellipse cy={-r * 0.45} rx={r * (0.14 + 0.08 * Math.abs(t[8]))} ry={r * 0.42} style="fill:{ink}" opacity="0.9" transform="rotate({(360 / Math.max(4, Math.round(count / 2))) * i})" />
			{/each}
			<circle r={r * 0.62} fill="none" stroke={accent} stroke-width={r * 0.03} stroke-dasharray="{r * 0.04} {r * 0.06}" />
		{:else if style === 'stripes'}
			{#each Array(count) as _, i}
				<rect x={-r} y={-r + (i * 2 * r) / count} width={r * 2} height={r / count} style="fill:{i % 4 === 3 ? accent : ink}" />
			{/each}
		{:else if style === 'dots'}
			{@const n = Math.max(5, Math.round(count * 0.8))}
			{#each Array(n) as _, row}
				{#each Array(n) as _, col}
					{@const x = -r + ((col + 0.5) * 2 * r) / n}
					{@const y = -r + ((row + 0.5) * 2 * r) / n}
					{@const d = Math.hypot(x, y) / r}
					<circle cx={x} cy={y} r={(r / n) * 0.45 * (1 - d * (0.5 + 0.4 * t[8]))} style="fill:{(row + col) % 5 === 0 ? accent : ink}" />
				{/each}
			{/each}
		{:else if style === 'arcs'}
			{#each Array(Math.max(3, Math.round(count / 2))) as _, i}
				{@const a0 = (i * 97 + t[9] * 90) % 360}
				<path d={arc(a0, a0 + 60 + ((i * 53) % 150), r * (0.9 - i * 0.11))} fill="none" style="stroke:{i % 2 ? accent : ink}" stroke-width={r * 0.07} stroke-linecap="round" />
			{/each}
		{:else}
			<circle r={r * 0.72} fill="none" style="stroke:{ink}" stroke-width={r * 0.05} />
			<text y={-r * 0.38} class="big" font-size={r * 0.32} fill={accent} text-anchor="middle" dominant-baseline="central">{keyCode || '33⅓'}</text>
		{/if}
	</g>
	<!-- centre: a plain disc so the spindle and key read on every style -->
	<circle r={r * 0.3} fill={bg} stroke={accent} stroke-width={r * 0.025} />
	{#if keyCode && style !== 'type'}
		<text y={r * 0.17} class="key" font-size={r * 0.13} fill={accent} text-anchor="middle" dominant-baseline="central">{keyCode}</text>
	{/if}
	<!-- spindle hole -->
	<circle r={r * 0.06} fill="#0b0810" />
</g>

<style>
	text {
		font-family: 'Unbounded', sans-serif;
		font-weight: 800;
	}
</style>
