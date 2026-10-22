<script>
	import LabelArt from './LabelArt.svelte';

	/** @type {{ sig: number[], size?: number, spinning?: boolean, title?: string }} */
	let { sig, size = 120, spinning = false, title = '' } = $props();

	const uid = $props.id();
</script>

<svg viewBox="-100 -100 200 200" width={size} height={size} class:spinning aria-hidden="true">
	<!-- vinyl -->
	<circle r="98" fill="#16111d" />
	{#each [90, 82, 74, 66, 58] as g}
		<circle r={g} fill="none" stroke="#2c2436" stroke-width="1.2" />
	{/each}
	<!-- sheen -->
	<path d="M -70 -55 A 90 90 0 0 1 -20 -88" fill="none" stroke="#ffffff22" stroke-width="10" stroke-linecap="round" />
	<path d="M 70 55 A 90 90 0 0 1 20 88" fill="none" stroke="#ffffff14" stroke-width="8" stroke-linecap="round" />
	<LabelArt {sig} r={44} />
	{#if title}
		<defs>
			<path id="arc-{uid}" d="M 0 -51 A 51 51 0 1 1 -0.1 -51" />
		</defs>
		<text class="arc-title">
			<textPath href="#arc-{uid}" startOffset="0">{title.toUpperCase()} • {title.toUpperCase()} •</textPath>
		</text>
	{/if}
</svg>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.spinning {
		animation: spin 1.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.arc-title {
		font-family: 'Unbounded', sans-serif;
		font-weight: 800;
		font-size: 7px;
		letter-spacing: 1px;
		fill: #fff6e9;
	}
</style>
