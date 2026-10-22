<script>
	// First-run guide: a floating card in the corner that walks through one mix.
	// The page decides when each step is done; this only shows it.

	/**
	 * @type {{
	 *   step: number,
	 *   canNext?: boolean,
	 *   onnext: () => void,
	 *   onclose: () => void
	 * }}
	 */
	let { step, canNext = false, onnext, onclose } = $props();

	const STEPS = [
		{
			title: 'Pick a track to start with',
			body: 'Click any record in the crate to drop it on the deck. Hover a sleeve to hear it first.',
			emoji: '💿'
		},
		{
			title: 'Set your filters',
			body: 'Slide the pitch range, turn the key knob or move the energy crossfader (chill, same, lift). The wheel updates live.',
			emoji: '🎛️'
		},
		{
			title: 'Pick a matching track',
			body: 'On the wheel, bigger and closer to the deck sounds more alike. Or dig the crate with "Mixable matches" on.',
			emoji: '🎯'
		},
		{
			title: 'Build your set list!',
			body: 'Keep picking. Played tracks line up at the bottom: drag to reorder, ✕ to remove.',
			emoji: '📼'
		}
	];

	const s = $derived(STEPS[step - 1]);
</script>

{#key step}
	<div class="tour" role="dialog" aria-label="How it works, step {step} of {STEPS.length}">
		<span class="badge" aria-hidden="true">{s.emoji}</span>
		<div class="text">
			<span class="count">Step {step} of {STEPS.length}</span>
			<h3>{s.title}</h3>
			<p>{s.body}</p>
		</div>
		<div class="foot">
			{#if step === 2}
				<button class="next" disabled={!canNext} onclick={onnext}>{canNext ? 'Next →' : 'Change a filter'}</button>
			{:else if step === 4}
				<button class="next" onclick={onnext}>Complete ✓</button>
			{:else}
				<span class="waiting">Waiting for your pick…</span>
			{/if}
			<span class="dots" aria-hidden="true">
				{#each STEPS as _, i}<i class:done={i < step - 1} class:on={i === step - 1}></i>{/each}
			</span>
		</div>
		<button class="close" onclick={onclose} aria-label="Close the guide">✕</button>
	</div>
{/key}

<style>
	/* Sits in the header's top-right corner, in the flow, so it never covers the controls. */
	.tour {
		position: relative;
		z-index: 60;
		max-width: 640px;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 40px 10px 12px;
		background: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 22px;
		box-shadow: 7px 7px 0 var(--ink);
		rotate: -0.6deg;
		animation: in 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	@keyframes in {
		from {
			opacity: 0;
			translate: 0 -16px;
			rotate: -4deg;
		}
	}
	.text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.badge {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		font-size: 24px;
		background: var(--yellow);
		border: 3px solid var(--ink);
		border-radius: 50%;
		rotate: -8deg;
	}
	.count {
		font-family: var(--display);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 1.5px;
	}
	.close {
		position: absolute;
		top: 6px;
		right: 8px;
		border: 0;
		background: none;
		font-size: 16px;
		cursor: pointer;
		padding: 4px;
		opacity: 0.6;
	}
	.close:hover {
		opacity: 1;
	}
	h3 {
		font-family: var(--display);
		font-weight: 900;
		font-size: 18px;
		line-height: 1.05;
		margin: 0;
	}
	p {
		margin: 0;
		font-size: 13px;
		line-height: 1.35;
	}
	.foot {
		flex: none;
		display: grid;
		justify-items: center;
		gap: 8px;
	}
	.dots {
		display: flex;
		gap: 6px;
	}
	.dots i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: var(--paper);
	}
	.dots i.done {
		background: var(--ink);
	}
	.dots i.on {
		background: var(--orange);
		width: 22px;
		border-radius: 99px;
	}
	.waiting {
		font-size: 13px;
		font-weight: 700;
		opacity: 0.6;
	}
	.next {
		font-family: var(--display);
		font-weight: 800;
		font-size: 14px;
		padding: 9px 14px;
		background: var(--orange);
		color: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 14px;
		box-shadow: 4px 4px 0 var(--ink);
		cursor: pointer;
	}
	.next:disabled {
		background: var(--cream);
		color: var(--ink);
		box-shadow: none;
		cursor: default;
		opacity: 0.7;
	}
	.next:not(:disabled):active {
		translate: 3px 3px;
		box-shadow: 1px 1px 0 var(--ink);
	}
	@media (max-width: 1000px) {
		.tour {
			flex-wrap: wrap;
			rotate: 0deg;
		}
	}
</style>
