<script>
	// The floating info card shown when hovering any record: orbit, deck or set list.
	// Positioned in the viewport above the hovered element, so scroll containers can't clip it.

	/**
	 * @type {{
	 *   track: import('#lib/server/tracks.js').Track,
	 *   rect: DOMRect,
	 *   match?: number | null,
	 *   label?: string,
	 *   bpmDelta?: number | null,
	 *   previewing?: boolean
	 * }}
	 */
	let { track, rect, match = null, label = '', bpmDelta = null, previewing = false } = $props();

	let width = $state(220);
	let height = $state(150);
	const left = $derived(Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)));
	// Above the record if there's room, otherwise below it.
	const top = $derived(rect.top - height - 12 > 8 ? rect.top - height - 12 : rect.bottom + 12);
</script>

<div class="card" style="left:{left}px; top:{top}px" bind:clientWidth={width} bind:clientHeight={height} role="tooltip">
	<div class="head">
		{#if match !== null}
			<strong class="pct">{Math.round(match * 100)}%</strong>
		{:else if label}
			<strong class="label">{label}</strong>
		{/if}
		{#if previewing}
			<span class="eq" aria-label="Previewing"><i></i><i></i><i></i><i></i></span>
		{/if}
	</div>
	<span class="title">{track.title}</span>
	<span class="artist">{track.artist}</span>
	<span class="chips">
		<span class="chip bpm"
			>{Math.round(track.bpm)} BPM{bpmDelta ? ` (${bpmDelta > 0 ? '+' : ''}${bpmDelta})` : ''}</span
		>
		<span class="chip key">{track.camelot}</span>
		{#if track.energy}<span class="chip energy">⚡ {track.energy}</span>{/if}
	</span>
</div>

<style>
	.card {
		position: fixed;
		z-index: 100;
		display: grid;
		gap: 2px;
		min-width: 190px;
		max-width: 280px;
		padding: 10px 14px 12px;
		background: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 16px;
		box-shadow: 5px 5px 0 var(--ink);
		pointer-events: none;
		animation: pop 0.18s cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	@keyframes pop {
		from {
			opacity: 0;
			translate: 0 8px;
		}
	}
	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 8px;
	}
	.pct {
		font-family: var(--display);
		font-size: 34px;
		line-height: 1;
		color: var(--orange);
	}
	.label {
		font-family: var(--display);
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--orange);
	}
	.title {
		font-weight: 700;
		font-size: 15px;
	}
	.artist {
		font-size: 13px;
		opacity: 0.7;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 4px;
	}
	.chip {
		font-size: 12px;
		font-weight: 700;
		padding: 2px 8px;
		border: 2px solid var(--ink);
		border-radius: 99px;
		white-space: nowrap;
	}
	.chip.bpm {
		background: var(--yellow);
	}
	.chip.key {
		background: var(--pink);
	}
	.chip.energy {
		background: var(--teal);
	}
	.eq {
		display: inline-flex;
		align-items: end;
		gap: 3px;
		height: 24px;
	}
	.eq i {
		width: 5px;
		background: var(--ink);
		border-radius: 2px;
		animation: eq 0.5s ease-in-out infinite alternate;
	}
	.eq i:nth-child(2) {
		animation-delay: -0.2s;
	}
	.eq i:nth-child(3) {
		animation-delay: -0.35s;
	}
	.eq i:nth-child(4) {
		animation-delay: -0.1s;
	}
	@keyframes eq {
		from {
			height: 4px;
		}
		to {
			height: 24px;
		}
	}
</style>
