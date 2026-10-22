<script>
	import { Spring } from 'svelte/motion';
	import Record from './Record.svelte';

	/**
	 * @type {{
	 *   track: import('#lib/server/tracks.js').Track & { match: number },
	 *   x: number, y: number, cx: number, cy: number, size: number, delay?: number,
	 *   previewing?: boolean,
	 *   ondrop: (id: string, x: number, y: number) => boolean,
	 *   onplay: (id: string) => void,
	 *   onhover: (el: HTMLElement | null) => void
	 * }}
	 */
	let { track, x, y, cx, cy, size, delay = 0, previewing = false, ondrop, onplay, onhover } = $props();

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
		if (Math.hypot(next.x - pos.current.x, next.y - pos.current.y) > 3) {
			if (!moved) onhover(null);
			moved = true;
		}
		pos.set(next, { instant: true });
	}

	function up() {
		if (!dragging) return;
		dragging = false;
		if (!moved) return onplay(track.id);
		if (!ondrop(track.id, pos.current.x, pos.current.y)) pos.target = { x, y };
	}
</script>

<button
	class="suggestion"
	class:dragging
	style="transform: translate({pos.current.x - size / 2}px, {pos.current.y - size / 2}px); width:{size}px; height:{size}px"
	onpointerenter={(e) => !dragging && onhover(e.currentTarget)}
	onpointerleave={() => !dragging && onhover(null)}
	onfocus={(e) => onhover(e.currentTarget)}
	onblur={() => onhover(null)}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	aria-label="Play {track.title} by {track.artist}, {Math.round(track.match * 100)}% match"
>
	<span class="bob" style="animation-delay:{-(delay % 2000)}ms">
		<Record sig={track.sig} energy={track.energy} keyCode={track.camelot} {size} spinning={previewing} />
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
	.suggestion:hover .bob,
	.dragging .bob {
		transform: scale(1.12) rotate(-8deg);
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
</style>
