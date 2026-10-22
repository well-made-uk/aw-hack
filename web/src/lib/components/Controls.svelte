<script>
	/**
	 * @type {{
	 *   tolerance: number,
	 *   keyMode: 'strict' | 'loose' | 'any',
	 *   energy: 'down' | 'any' | 'up'
	 * }}
	 */
	let { tolerance = $bindable(), keyMode = $bindable(), energy = $bindable() } = $props();

	const KEY_MODES = /** @type {const} */ (['strict', 'loose', 'any']);
	const KEY_ANGLES = { strict: -50, loose: 0, any: 50 };
	const ENERGY = /** @type {const} */ (['down', 'any', 'up']);

	function turnKnob() {
		keyMode = KEY_MODES[(KEY_MODES.indexOf(keyMode) + 1) % KEY_MODES.length];
	}
</script>

<div class="controls">
	<label class="fader">
		<span class="label">Pitch range</span>
		<span class="readout">±{tolerance}%</span>
		<input type="range" min="2" max="12" step="1" bind:value={tolerance} aria-label="BPM tolerance" />
	</label>

	<div class="knob-wrap">
		<span class="label">Key match</span>
		<button class="knob" onclick={turnKnob} aria-label="Key match: {keyMode}. Click to change.">
			<span class="dial" style="rotate:{KEY_ANGLES[keyMode]}deg"><span class="tick"></span></span>
		</button>
		<div class="knob-labels">
			{#each KEY_MODES as m}
				<button class:on={keyMode === m} onclick={() => (keyMode = m)}>{m}</button>
			{/each}
		</div>
	</div>

	<label class="xfader">
		<span class="label">Energy</span>
		<input
			type="range"
			min="0"
			max="2"
			step="1"
			value={ENERGY.indexOf(energy)}
			oninput={(e) => (energy = ENERGY[Number(e.currentTarget.value)])}
			aria-label="Energy: {energy}"
		/>
		<span class="ends"><span>↓ chill</span><span>↑ lift</span></span>
	</label>
</div>

<style>
	.controls {
		display: grid;
		gap: 22px;
		padding: 22px 20px;
		background: var(--blue);
		color: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 28px;
		box-shadow: 7px 7px 0 var(--ink);
		width: 200px;
	}
	.label {
		font-family: var(--display);
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	.fader {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 8px;
	}
	.readout {
		font-family: var(--display);
		font-size: 26px;
		color: var(--yellow);
	}
	input[type='range'] {
		grid-column: 1 / -1;
		width: 100%;
		appearance: none;
		height: 14px;
		background: var(--ink);
		border-radius: 99px;
		cursor: pointer;
	}
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 30px;
		height: 44px;
		background: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 8px;
		box-shadow: inset 0 -8px 0 var(--orange);
	}
	input[type='range']::-moz-range-thumb {
		width: 26px;
		height: 40px;
		background: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 8px;
		box-shadow: inset 0 -8px 0 var(--orange);
	}
	.knob-wrap {
		display: grid;
		justify-items: center;
		gap: 8px;
	}
	.knob-wrap .label {
		justify-self: start;
	}
	.knob {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		border: 3px solid var(--ink);
		background: repeating-conic-gradient(var(--paper) 0 8deg, #e9dcc7 8deg 16deg);
		box-shadow: 4px 4px 0 var(--ink);
		cursor: pointer;
		padding: 10px;
	}
	.dial {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: var(--orange);
		border: 3px solid var(--ink);
		position: relative;
		transition: rotate 0.4s cubic-bezier(0.3, 1.8, 0.5, 1);
	}
	.tick {
		position: absolute;
		left: 50%;
		top: 6px;
		width: 6px;
		height: 22px;
		margin-left: -3px;
		background: var(--ink);
		border-radius: 3px;
	}
	.knob-labels {
		display: flex;
		gap: 4px;
	}
	.knob-labels button {
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 99px;
		border: 2px solid var(--ink);
		background: transparent;
		color: var(--paper);
		cursor: pointer;
	}
	.knob-labels button.on {
		background: var(--yellow);
		color: var(--ink);
	}
	.xfader {
		display: grid;
		gap: 8px;
	}
	.ends {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		font-weight: 700;
	}
</style>
