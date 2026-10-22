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
	const KEY_ANGLES = { strict: -60, loose: 0, any: 60 };
	const ENERGY = /** @type {const} */ (['down', 'any', 'up']);

	// Knob: drag left/right to turn. It follows the pointer, then snaps to the nearest position.
	/** @type {number | null} */
	let dragAngle = $state(null);
	let dragStart = { x: 0, angle: 0 };
	const angle = $derived(dragAngle ?? KEY_ANGLES[keyMode]);

	/** @param {number} a */
	function nearestMode(a) {
		return a < -30 ? 'strict' : a > 30 ? 'any' : 'loose';
	}

	/** @param {PointerEvent} e */
	function knobDown(e) {
		dragStart = { x: e.clientX, angle: KEY_ANGLES[keyMode] };
		dragAngle = dragStart.angle;
		/** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
	}

	/** @param {PointerEvent} e */
	function knobMove(e) {
		if (dragAngle === null) return;
		dragAngle = Math.max(-75, Math.min(75, dragStart.angle + (e.clientX - dragStart.x) * 1.4));
		keyMode = nearestMode(dragAngle);
	}

	function knobUp() {
		dragAngle = null;
	}

	/** @param {KeyboardEvent} e */
	function knobKey(e) {
		const i = KEY_MODES.indexOf(keyMode);
		if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') keyMode = KEY_MODES[Math.max(0, i - 1)];
		else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') keyMode = KEY_MODES[Math.min(2, i + 1)];
		else return;
		e.preventDefault();
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
		<div class="knob-ring">
			{#each KEY_MODES as m}
				<span class="marker" class:on={keyMode === m} style="rotate:{KEY_ANGLES[m]}deg">
					<span class="notch"></span>
					<span class="marker-label" style="rotate:{-KEY_ANGLES[m]}deg">{m}</span>
				</span>
			{/each}
			<div
				class="knob"
				class:dragging={dragAngle !== null}
				role="slider"
				tabindex="0"
				aria-label="Key match"
				aria-valuemin="0"
				aria-valuemax="2"
				aria-valuenow={KEY_MODES.indexOf(keyMode)}
				aria-valuetext={keyMode}
				onpointerdown={knobDown}
				onpointermove={knobMove}
				onpointerup={knobUp}
				onpointercancel={knobUp}
				onkeydown={knobKey}
			>
				<span class="dial" style="rotate:{angle}deg"><span class="tick"></span></span>
			</div>
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
		gap: 4px;
	}
	.knob-ring {
		position: relative;
		width: 150px;
		height: 146px;
		justify-self: center;
		display: grid;
		place-items: end center;
	}
	.marker {
		position: absolute;
		left: 50%;
		bottom: 48px;
		width: 0;
		height: 68px;
		transform-origin: 50% 100%;
	}
	.notch {
		position: absolute;
		top: 0;
		left: -3px;
		width: 6px;
		height: 10px;
		border-radius: 3px;
		background: var(--paper);
		opacity: 0.5;
	}
	.marker.on .notch {
		background: var(--yellow);
		opacity: 1;
	}
	.marker-label {
		position: absolute;
		top: -22px;
		left: 0;
		translate: -50% 0;
		font-size: 12px;
		font-weight: 700;
		opacity: 0.7;
	}
	.marker.on .marker-label {
		color: var(--yellow);
		opacity: 1;
	}
	.knob {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		border: 3px solid var(--ink);
		background: repeating-conic-gradient(var(--paper) 0 8deg, #e9dcc7 8deg 16deg);
		box-shadow: 4px 4px 0 var(--ink);
		cursor: ew-resize;
		padding: 10px;
		touch-action: none;
		user-select: none;
	}
	.knob:focus-visible {
		outline: 3px dashed var(--yellow);
		outline-offset: 4px;
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
	.dragging .dial {
		transition: none;
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
