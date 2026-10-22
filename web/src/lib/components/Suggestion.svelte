<script>
	import { Spring } from 'svelte/motion';
	import Record from './Record.svelte';

	/**
	 * @type {{
	 *   track: import('#lib/server/tracks.js').Track & { match: number },
	 *   x: number, y: number, cx: number, cy: number, size: number, delay?: number,
	 *   bpmDelta: number,
	 *   previewing?: boolean,
	 *   ondrop: (id: string, x: number, y: number) => boolean,
	 *   onplay: (id: string) => void,
	 *   onhover: (id: string | null) => void
	 * }}
	 */
	let { track, x, y, cx, cy, size, delay = 0, bpmDelta, previewing = false, ondrop, onplay, onhover } = $props();

	// Start at the centre and fly out to the orbit slot.
	// svelte-ignore state_referenced_locally
	const pos = new Spring({ x: cx, y: cy }, { stiffness: 0.06, damping: 0.42 });
	let dragging = $state(false);
	let moved = false;
	let grab = { dx: 0, dy: 0 };

	$effect(() => {
		const target = { x, y };
		if (dragging) return;
		const t = setTimeout(() => (pos.target = target), delay);
		return () => clearTimeout(t);
	});

	/** @param {PointerEvent} e */
	function down(e) {
		dragging = true;
		moved = false;
		grab = { dx: e.clientX - pos.current.x, dy: e.clientY - pos.current.y };
		/** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
	}

	/** @param {PointerEvent} e */
	function move(e) {
		if (!dragging) return;
		const next = { x: e.clientX - grab.dx, y: e.clientY - grab.dy };
		if (Math.hypot(next.x - pos.current.x, next.y - pos.current.y) > 3) moved = true;
		pos.set(next, { instant: true });
	}

	function up() {
		if (!dragging) return;
		dragging = false;
		if (!moved) return onplay(track.id);
		if (!ondrop(track.id, pos.current.x, pos.current.y)) pos.target = { x, y };
	}

	const pct = $derived(Math.round(track.match * 100));
</script>

<button
	class="suggestion"
	class:dragging
	style="transform: translate({pos.current.x - size / 2}px, {pos.current.y - size / 2}px); width:{size}px; height:{size}px"
	class:previewing
	onpointerenter={() => onhover(track.id)}
	onpointerleave={() => !dragging && onhover(null)}
	onfocus={() => onhover(track.id)}
	onblur={() => onhover(null)}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	aria-label="Play {track.title} by {track.artist}, {pct}% match"
>
	<span class="bob" style="animation-delay:{-(delay % 2000)}ms">
		<Record sig={track.sig} {size} spinning={previewing} />
	</span>
	<span class="badge">
		<strong>{pct}%{#if previewing}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>{/if}</strong>
		<span class="badge-title">{track.title}</span>
		<span class="badge-meta">{track.artist}</span>
		<span class="chips">
			<span class="chip bpm">{Math.round(track.bpm)} BPM{bpmDelta ? ` (${bpmDelta > 0 ? '+' : ''}${bpmDelta})` : ''}</span>
			<span class="chip key">{track.camelot}</span>
		</span>
	</span>
</button>

<style>
	.suggestion {
		position: absolute;
		left: 0;
		top: 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: grab;
		touch-action: none;
		border-radius: 50%;
		z-index: 2;
	}
	.suggestion:hover,
	.suggestion:focus-visible {
		z-index: 5;
	}
	.suggestion.dragging {
		cursor: grabbing;
		z-index: 10;
	}
	.suggestion:focus-visible {
		outline: 4px dashed var(--orange);
		outline-offset: 4px;
	}
	.bob {
		display: block;
		animation: bob 4s ease-in-out infinite;
		transition: transform 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
		filter: drop-shadow(4px 6px 0 #1a142333);
	}
	.previewing::before {
		content: '';
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		border: 4px solid var(--orange);
		animation: listening 0.9s ease-out infinite;
		pointer-events: none;
	}
	@keyframes listening {
		from {
			scale: 0.95;
			opacity: 1;
		}
		to {
			scale: 1.35;
			opacity: 0;
		}
	}
	.suggestion:hover .bob,
	.dragging .bob {
		transform: scale(1.18) rotate(-8deg);
		animation-play-state: paused;
	}
	@keyframes bob {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: 0 -6px;
		}
	}
	.badge {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 10px);
		translate: -50% 8px;
		opacity: 0;
		pointer-events: none;
		display: grid;
		gap: 2px;
		min-width: 170px;
		padding: 10px 14px 12px;
		background: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 16px;
		box-shadow: 5px 5px 0 var(--ink);
		text-align: left;
		transition:
			opacity 0.15s,
			translate 0.2s cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	.suggestion:hover .badge,
	.suggestion:focus-visible .badge,
	.dragging .badge {
		opacity: 1;
		translate: -50% 0;
	}
	.badge strong {
		font-family: var(--display);
		font-size: 34px;
		line-height: 1;
		color: var(--orange);
	}
	.eq {
		display: inline-flex;
		align-items: end;
		gap: 3px;
		height: 22px;
		margin-left: 10px;
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
	@keyframes eq {
		from {
			height: 4px;
		}
		to {
			height: 22px;
		}
	}
	.badge-title {
		font-weight: 700;
		font-size: 15px;
	}
	.badge-meta {
		font-size: 13px;
		opacity: 0.7;
	}
	.chips {
		display: flex;
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
</style>
