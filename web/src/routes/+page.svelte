<script>
	import Record from '#lib/components/Record.svelte';
	import LabelArt from '#lib/components/LabelArt.svelte';
	import Suggestion from '#lib/components/Suggestion.svelte';
	import Controls from '#lib/components/Controls.svelte';
	import TrackCard from '#lib/components/TrackCard.svelte';
	import { compatibleKeys, energyLevels, keyAngle, mixableBpms } from '#lib/camelot.js';

	/** @typedef {import('#lib/server/tracks.js').Track} Track */
	/** @typedef {Track & { match: number }} Suggested */

	// Weaker matches than this stay off the wheel.
	const MIN_MATCH = 0.55;

	let { data } = $props();

	// The crate streams in after first paint (it can take a few seconds with a big library).
	/** @type {Track[]} */
	let tracks = $state([]);
	let crateLoading = $state(true);
	$effect(() => {
		Promise.resolve(data.tracks).then((t) => {
			tracks = t;
			crateLoading = false;
		});
	});

	/** @type {string | null} */
	let playingId = $state(null);
	let result = $state(/** @type {{ playing: Track, suggestions: Suggested[] } | null} */ (null));
	let loadingNext = $state(false);
	/** @type {Track[]} */
	let setlist = $state([]);
	let crateOpen = $state(true);
	let search = $state('');

	let tolerance = $state(6);
	/** @type {'strict' | 'loose' | 'any'} */
	let keyMode = $state('loose');
	/** @type {'down' | 'any' | 'up'} */
	let energy = $state('any');

	let stageWidth = $state(640);
	let stageHeight = $state(0);

	// Crate "sort by match": the whole crate ranked by sound against the playing track.
	let sortByMatch = $state(false);
	/** @type {Map<string, number>} */
	let crateMatches = $state(new Map());

	// Hover previews, streamed from your own music folder (only when MUSIC_DIR is set).
	/** @type {string | null} */
	let previewId = $state(null);
	/** @type {HTMLAudioElement | undefined} */
	let audio = $state();
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let hoverTimer;
	/** @type {ReturnType<typeof setInterval> | undefined} */
	let fadeTimer;

	/** @param {number} to @param {() => void} [done] */
	function fade(to, done) {
		clearInterval(fadeTimer);
		fadeTimer = setInterval(() => {
			if (!audio) return;
			const v = audio.volume + (to > audio.volume ? 0.1 : -0.1);
			audio.volume = Math.min(1, Math.max(0, v));
			if (Math.abs(audio.volume - to) < 0.05) {
				audio.volume = to;
				clearInterval(fadeTimer);
				done?.();
			}
		}, 30);
	}

	/** Hovering a record previews it; leaving fades it out. @param {string | null} id */
	function hover(id) {
		if (!data.previews) return;
		clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => (id ? startPreview(id) : stopPreview()), id ? 200 : 120);
	}

	/** @param {string} id */
	function startPreview(id) {
		if (!audio || previewId === id) return;
		previewId = id;
		// Start just before the track's biggest moment, or 40% in for older analyses.
		const t = byId.get(id);
		const start = Math.round(t?.peak_at !== undefined ? Math.max(0, t.peak_at - 4) : (t?.duration ?? 300) * 0.4);
		audio.src = `/api/preview/${id}#t=${start}`;
		audio.volume = 0;
		audio.play().then(() => fade(1)).catch(() => (previewId = null));
	}

	function stopPreview() {
		if (!previewId) return;
		previewId = null;
		fade(0, () => audio?.pause());
	}

	// One floating info card, shared by every record on screen.
	/** @type {{ track: Track, rect: DOMRect, match?: number | null, label?: string, bpmDelta?: number | null } | null} */
	let card = $state(null);

	/**
	 * @param {Track} track
	 * @param {HTMLElement} el
	 * @param {{ match?: number | null, label?: string, bpmDelta?: number | null }} [extra]
	 */
	function hoverOn(track, el, extra = {}) {
		card = { track, rect: el.getBoundingClientRect(), ...extra };
		hover(track.id);
	}

	function hoverOff() {
		card = null;
		hover(null);
	}

	const byId = $derived(new Map(tracks.map((t) => [t.id, t])));
	const playing = $derived(playingId ? byId.get(playingId) : null);

	// Ask VectorsDB for the next tracks whenever the deck or a control changes.
	$effect(() => {
		if (!playingId) return;
		const id = playingId;
		const params = new URLSearchParams({ id, keys: keyMode, energy, tol: String(tolerance) });
		loadingNext = true;
		fetch(`/api/next?${params}`)
			.then((r) => r.json())
			.then((d) => {
				if (id !== playingId) return;
				result = d;
				loadingNext = false;
			})
			.catch(() => (loadingNext = false));
	});

	/** @param {string} id */
	function play(id) {
		clearTimeout(hoverTimer);
		stopPreview();
		card = null;
		if (id === playingId) return;
		if (playing) setlist = [...setlist, playing];
		playingId = id;
		crateOpen = false;
	}

	// Set list editing: remove, and drag to reorder (the track on deck stays last).
	/** @param {number} i */
	function removeFromSet(i) {
		setlist = setlist.filter((_, j) => j !== i);
		card = null;
	}

	/** @type {number | null} */
	let dragFrom = $state(null);
	/** @type {number | null} */
	let dragOver = $state(null);

	/** @param {number} to */
	function dropInSet(to) {
		if (dragFrom === null || dragFrom === to) return;
		const next = [...setlist];
		const [moved] = next.splice(dragFrom, 1);
		next.splice(to, 0, moved);
		setlist = next;
	}

	// Geometry: everything is relative to the square stage.
	const S = $derived(Math.max(300, stageHeight ? Math.min(stageWidth, stageHeight) : stageWidth));
	const C = $derived(S / 2);
	const R = $derived(S / 2 - 6);
	const deckR = $derived(R * 0.27);
	const orbitMax = $derived(R * 0.69);

	const SLICES = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [`${n}A`, `${n}B`]);
	const glowing = $derived(new Set(playing ? (compatibleKeys(playing.camelot, keyMode) ?? SLICES) : []));

	/** Point on the stage at `deg` (0 = top, clockwise) and radius `r`. */
	function polar(/** @type {number} */ deg, /** @type {number} */ r) {
		const a = (deg * Math.PI) / 180;
		return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
	}

	/** SVG path for a ring segment. */
	function sector(/** @type {number} */ a0, /** @type {number} */ a1, /** @type {number} */ r0, /** @type {number} */ r1) {
		const p0 = polar(a0, r1), p1 = polar(a1, r1), p2 = polar(a1, r0), p3 = polar(a0, r0);
		return `M${p0.x},${p0.y} A${r1},${r1} 0 0 1 ${p1.x},${p1.y} L${p2.x},${p2.y} A${r0},${r0} 0 0 0 ${p3.x},${p3.y}Z`;
	}

	/** @param {string} code */
	const sliceHue = (code) => ((parseInt(code, 10) - 1) * 30 + 200) % 360;

	const shown = $derived(result ? result.suggestions.filter((s) => s.match >= MIN_MATCH) : []);

	// Lay suggestions out in their key's slice: closer to the deck and bigger = sounds more alike.
	const placed = $derived.by(() => {
		if (!playing || !shown.length) return [];
		const hi = Math.max(...shown.map((s) => s.match));
		const lo = Math.min(...shown.map((s) => s.match));
		/** @type {{ [key: string]: number }} */
		const perKey = {};
		const spread = [0, 14, -14, 26, -26, 36, -36];
		const items = shown.map((s, i) => {
			const slot = (perKey[s.camelot] = (perKey[s.camelot] ?? -1) + 1);
			const strength = Math.min(1, (s.match - MIN_MATCH) / (1 - MIN_MATCH));
			const size = R * (0.13 + 0.13 * strength);
			const closeness = hi === lo ? 1 : (s.match - lo) / (hi - lo);
			const rIn = deckR + size / 2 + 10;
			const rOut = orbitMax - size / 2;
			const r = rOut - closeness * (rOut - rIn);
			const { x, y } = polar(keyAngle(s.camelot) + spread[slot % spread.length], r);
			return { track: s, x, y, size, bpmDelta: Math.round(s.bpm - playing.bpm), delay: i * 60 };
		});
		// Nudge overlapping records apart, keeping them inside the orbit ring.
		for (let iter = 0; iter < 60; iter++) {
			for (let i = 0; i < items.length; i++) {
				for (let j = i + 1; j < items.length; j++) {
					const a = items[i], b = items[j];
					const dx = b.x - a.x, dy = b.y - a.y;
					const dist = Math.hypot(dx, dy) || 0.01;
					const min = (a.size + b.size) / 2 + 6;
					if (dist >= min) continue;
					const push = (min - dist) / 2;
					a.x -= (dx / dist) * push, a.y -= (dy / dist) * push;
					b.x += (dx / dist) * push, b.y += (dy / dist) * push;
				}
			}
			for (const it of items) {
				const dx = it.x - C, dy = it.y - C;
				const dist = Math.hypot(dx, dy) || 0.01;
				const r = Math.min(Math.max(dist, deckR + it.size / 2 + 8), orbitMax - it.size / 2);
				it.x = C + (dx / dist) * r;
				it.y = C + (dy / dist) * r;
			}
		}
		return items;
	});

	/** Dropped on the deck? */
	function drop(/** @type {string} */ id, /** @type {number} */ x, /** @type {number} */ y) {
		if (Math.hypot(x - C, y - C) > deckR * 1.1) return false;
		play(id);
		return true;
	}

	$effect(() => {
		if (!sortByMatch || !playingId) return;
		const id = playingId;
		fetch(`/api/next?${new URLSearchParams({ id, all: '1' })}`)
			.then((r) => r.json())
			.then((/** @type {{ suggestions: Suggested[] }} */ d) => {
				if (id === playingId) crateMatches = new Map(d.suggestions.map((s) => [s.id, s.match]));
			});
	});

	/** Would this track mix in with the current pitch, key and energy settings? @param {Track} t */
	function mixable(t) {
		if (!playing || t.id === playing.id) return false;
		const keys = compatibleKeys(playing.camelot, keyMode);
		const levels = energyLevels(playing.energy, energy);
		return (
			(!keys || keys.includes(t.camelot)) &&
			(!levels || levels.includes(String(t.energy))) &&
			mixableBpms(playing.bpm, tolerance).includes(String(Math.round(t.bpm)))
		);
	}

	const sorting = $derived(sortByMatch && Boolean(playing) && crateMatches.size > 0);
	const crate = $derived.by(() => {
		const found = tracks.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(search.toLowerCase()));
		if (!sorting) return found;
		// Best matches first; tracks outside the top results keep crate order after them.
		return found.toSorted((a, b) => (crateMatches.get(b.id) ?? -1) - (crateMatches.get(a.id) ?? -1));
	});
</script>

<audio bind:this={audio} preload="none"></audio>

<div class="page">
	<header>
		<h1>Next<span>Track</span></h1>
		<span class="source" class:live={data.source === 'vectorsdb'}>
			{data.source === 'vectorsdb' ? '● Live from VectorsDB' : 'Demo crate'}
		</span>
	</header>

	<main>
		<section class="now">
			{#if playing}
				<p class="kicker">Now playing</p>
				<h2>{playing.title}</h2>
				<p class="artist">{playing.artist}</p>
				<div class="stickers">
					<span class="sticker bpm">{Math.round(playing.bpm)}<small>BPM</small></span>
					<span class="sticker key" style="--h:{sliceHue(playing.camelot)}">{playing.camelot}</span>
					{#if playing.energy}<span class="sticker energy">⚡{playing.energy}</span>{/if}
					{#if playing.genre}<span class="sticker genre">{playing.genre}</span>{/if}
				</div>
			{:else}
				<p class="kicker">Start here</p>
				<h2>Pick a record to drop.</h2>
			{/if}
			<button class="dig" onclick={() => (crateOpen = true)}>Dig the crate ↓</button>
		</section>

		<section class="stage" bind:clientWidth={stageWidth} bind:clientHeight={stageHeight}>
			<div class="square" style="width:{S}px; height:{S}px">
				<svg class="wheel" width={S} height={S} aria-hidden="true">
					{#each SLICES as code}
						{@const n = parseInt(code, 10)}
						{@const a = (n - 1) * 30}
						{@const outer = code.endsWith('B')}
						{@const lit = glowing.has(code)}
						{@const isNow = playing?.camelot === code}
						<path
							d={sector(a - 15, a + 15, outer ? R * 0.86 : R * 0.73, outer ? R : R * 0.86)}
							fill="hsl({sliceHue(code)} {lit ? 85 : 30}% {isNow ? 55 : lit ? 70 : outer ? 88 : 82}%)"
							stroke="var(--ink)"
							stroke-width="2.5"
							class="slice"
						/>
						{@const p = polar(a, outer ? R * 0.93 : R * 0.795)}
						<text
							x={p.x}
							y={p.y}
							font-size={Math.max(8, R * 0.042)}
							class="slice-label"
							class:lit
							dominant-baseline="central"
							text-anchor="middle">{code}</text
						>
					{/each}
					<circle cx={C} cy={C} r={orbitMax + 4} fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round" />
				</svg>

				{#if playing}
					{#key playing.id}
						<div
							class="deck"
							role="img"
							aria-label="On deck: {playing.title}"
							style="--size:{deckR * 2}px; left:{C}px; top:{C}px"
							onpointerenter={(e) => hoverOn(playing, e.currentTarget, { label: 'On deck' })}
							onpointerleave={hoverOff}
						>
							<Record sig={playing.sig} size={deckR * 2} spinning title={playing.title} />
						</div>
					{/key}

					{#each placed as p (p.track.id)}
						<Suggestion
							track={p.track}
							x={p.x}
							y={p.y}
							cx={C}
							cy={C}
							size={p.size}
							delay={p.delay}
							previewing={previewId === p.track.id}
							ondrop={drop}
							onplay={play}
							onhover={(el) => (el ? hoverOn(p.track, el, { match: p.track.match, bpmDelta: p.bpmDelta }) : hoverOff())}
						/>
					{/each}
					{#if loadingNext}
						<p class="status" style="left:{C}px; top:{C + deckR + 24}px"><span class="spinner"></span> Finding matches…</p>
					{:else if result && !shown.length}
						<p class="status" style="left:{C}px; top:{C + deckR + 24}px">No close matches. Loosen key, pitch or energy →</p>
					{/if}
				{:else}
					<div class="deck idle" style="--size:{deckR * 2}px; left:{C}px; top:{C}px"></div>
				{/if}
			</div>
		</section>

		<aside>
			<Controls bind:tolerance bind:keyMode bind:energy />
		</aside>
	</main>

	<footer class="setlist">
		<span class="kicker">Your set</span>
		<ol>
			{#each setlist as t, i (t.id + i)}
				<li
					class="set-card"
					class:drag-over={dragOver === i && dragFrom !== i}
					class:dragging={dragFrom === i}
					draggable="true"
					ondragstart={(e) => {
						dragFrom = i;
						card = null;
						e.dataTransfer?.setData('text/plain', String(i));
					}}
					ondragover={(e) => {
						e.preventDefault();
						dragOver = i;
					}}
					ondragleave={() => dragOver === i && (dragOver = null)}
					ondrop={(e) => {
						e.preventDefault();
						dropInSet(i);
						dragFrom = dragOver = null;
					}}
					ondragend={() => (dragFrom = dragOver = null)}
				>
					<span
						class="set-art"
						role="img"
						aria-label={t.title}
						onpointerenter={(e) => hoverOn(t, e.currentTarget)}
						onpointerleave={hoverOff}
					>
						<svg viewBox="-50 -50 100 100" width="52" height="52" aria-hidden="true"><LabelArt sig={t.sig} r={50} /></svg>
					</span>
					<span class="set-text">
						<span class="set-n">{i + 1}</span>
						<span class="set-title">{t.title}</span>
						<span class="set-meta">{Math.round(t.bpm)} · {t.camelot}{t.energy ? ` · ⚡${t.energy}` : ''}</span>
					</span>
					<button class="set-remove" onclick={() => removeFromSet(i)} aria-label="Remove {t.title} from the set">✕</button>
				</li>
			{/each}
			{#if playing}
				<li class="set-card on-deck">
					<span
						class="set-art"
						role="img"
						aria-label={playing.title}
						onpointerenter={(e) => hoverOn(playing, e.currentTarget, { label: 'On deck' })}
						onpointerleave={hoverOff}
					>
						<svg viewBox="-50 -50 100 100" width="52" height="52" aria-hidden="true"><LabelArt sig={playing.sig} r={50} /></svg>
					</span>
					<span class="set-text">
						<span class="set-n">On deck</span>
						<span class="set-title">{playing.title}</span>
						<span class="set-meta">{Math.round(playing.bpm)} · {playing.camelot}{playing.energy ? ` · ⚡${playing.energy}` : ''}</span>
					</span>
				</li>
			{:else}
				<li class="placeholder">Records you play line up here.</li>
			{/if}
		</ol>
	</footer>

	{#if crateOpen}
		<div class="crate" role="dialog" aria-label="Your crate">
			<div class="crate-head">
				<h2>The crate</h2>
				<input placeholder="Search title or artist…" bind:value={search} />
				{#if playing}
					<label class="sort">
						<input type="checkbox" bind:checked={sortByMatch} />
						<span class="switch" aria-hidden="true"></span>
						Sort by match to <strong>{playing.title}</strong>
					</label>
					<button class="close" onclick={() => (crateOpen = false)} aria-label="Close">✕</button>
				{/if}
			</div>
			{#if crateLoading}
				<div class="loader">
					<span class="loader-record"><Record sig={Array(16).fill(0.02)} size={140} spinning /></span>
					<p>Digging through your crate…</p>
				</div>
			{:else}
				<div class="sleeves">
					{#each crate as t (t.id)}
						<button
							class="sleeve"
							style="--h:{sliceHue(t.camelot)}"
							onclick={() => play(t.id)}
							onpointerenter={() => hover(t.id)}
							onpointerleave={() => hover(null)}
						>
							<span class="peek"><Record sig={t.sig} size={150} spinning={previewId === t.id} /></span>
							<span class="sleeve-title">{t.title}</span>
							<span class="sleeve-meta">{t.artist}</span>
							<span class="sleeve-tags">{Math.round(t.bpm)} · {t.camelot}{t.energy ? ` · ⚡${t.energy}` : ''}</span>
							{#if previewId === t.id}
								<span class="sleeve-eq" aria-label="Previewing"><i></i><i></i><i></i><i></i></span>
							{/if}
							{#if t.id === playing?.id}
								<span class="sleeve-badge on-deck">On deck</span>
							{:else if sorting && crateMatches.has(t.id)}
								<span class="sleeve-badge" class:mix={mixable(t)}>
									{Math.round((crateMatches.get(t.id) ?? 0) * 100)}%{mixable(t) ? ' · mixable' : ''}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if card}
		<TrackCard {...card} previewing={previewId === card.track.id} />
	{/if}
</div>

<style>
	/* Desktop: exactly one screen, no scrolling. Smaller screens stack and scroll (see media queries). */
	.page {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		padding: 16px 28px 0;
		overflow: hidden;
	}
	header {
		display: flex;
		align-items: center;
		gap: 18px;
	}
	h1 {
		font-family: var(--display);
		font-weight: 900;
		font-size: clamp(36px, 5vw, 64px);
		margin: 0;
		letter-spacing: -2px;
		line-height: 1;
	}
	h1 span {
		color: var(--orange);
		-webkit-text-stroke: 2px var(--ink);
		margin-left: 6px;
	}
	.source {
		font-weight: 700;
		font-size: 13px;
		padding: 6px 12px;
		border: 2.5px solid var(--ink);
		border-radius: 99px;
		background: var(--paper);
		rotate: -3deg;
	}
	.source.live {
		background: var(--teal);
	}
	main {
		display: grid;
		grid-template-columns: minmax(220px, 1fr) minmax(0, 2.4fr) auto;
		gap: 28px;
		align-items: center;
		min-height: 0;
		padding: 8px 0;
	}
	.now {
		align-self: center;
	}
	.kicker {
		font-family: var(--display);
		text-transform: uppercase;
		letter-spacing: 2px;
		font-size: 13px;
		margin: 0 0 6px;
	}
	.now h2 {
		font-family: var(--display);
		font-weight: 900;
		font-size: clamp(30px, 3.6vw, 58px);
		line-height: 0.95;
		margin: 0;
		letter-spacing: -1px;
		word-break: break-word;
	}
	.artist {
		font-size: 22px;
		font-weight: 500;
		margin: 8px 0 16px;
	}
	.stickers {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.sticker {
		font-family: var(--display);
		font-weight: 800;
		font-size: 24px;
		padding: 8px 16px;
		border: 3px solid var(--ink);
		border-radius: 16px;
		box-shadow: 4px 4px 0 var(--ink);
	}
	.sticker small {
		font-size: 12px;
		margin-left: 4px;
	}
	.sticker.bpm {
		background: var(--yellow);
		rotate: -4deg;
	}
	.sticker.key {
		background: hsl(var(--h) 85% 70%);
		rotate: 3deg;
	}
	.sticker.energy {
		background: var(--teal);
		rotate: -2deg;
	}
	.sticker.genre {
		background: var(--pink);
		font-size: 16px;
		align-self: center;
		rotate: -2deg;
	}
	.dig {
		margin-top: 26px;
		font-family: var(--display);
		font-weight: 800;
		font-size: 18px;
		padding: 14px 22px;
		background: var(--orange);
		color: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 18px;
		box-shadow: 5px 5px 0 var(--ink);
		cursor: pointer;
		transition:
			translate 0.1s,
			box-shadow 0.1s;
	}
	.dig:hover {
		translate: -2px -2px;
		box-shadow: 7px 7px 0 var(--ink);
	}
	.dig:active {
		translate: 3px 3px;
		box-shadow: 2px 2px 0 var(--ink);
	}

	.stage {
		width: 100%;
		height: 100%;
		min-height: 0;
		display: grid;
		place-items: center;
	}
	.square {
		position: relative;
	}
	.wheel {
		position: absolute;
		inset: 0;
		overflow: visible;
	}
	.slice {
		transition: fill 0.4s;
	}
	.slice-label {
		font-family: var(--display);
		font-weight: 800;
		fill: var(--ink);
		opacity: 0.45;
		transition: opacity 0.3s;
	}
	.slice-label.lit {
		opacity: 1;
	}
	.deck {
		position: absolute;
		width: var(--size);
		height: var(--size);
		translate: -50% -50%;
		border-radius: 50%;
		filter: drop-shadow(8px 10px 0 #1a142355);
		animation: needle-drop 0.7s cubic-bezier(0.3, 1.7, 0.5, 1);
		z-index: 1;
	}
	.deck.idle {
		background: repeating-radial-gradient(#16111d 0 6px, #2c2436 6px 8px);
		animation: none;
		opacity: 0.25;
	}
	@keyframes needle-drop {
		0% {
			scale: 1.5;
			opacity: 0;
			rotate: -40deg;
		}
		100% {
			scale: 1;
			opacity: 1;
			rotate: 0deg;
		}
	}
	.status {
		position: absolute;
		translate: -50% 0;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-weight: 700;
		background: var(--paper);
		border: 2.5px solid var(--ink);
		border-radius: 12px;
		padding: 8px 12px;
		white-space: nowrap;
		z-index: 4;
	}
	.spinner {
		width: 14px;
		height: 14px;
		border: 3px solid var(--ink);
		border-right-color: transparent;
		border-radius: 50%;
		animation: turn 0.8s linear infinite;
	}
	@keyframes turn {
		to {
			rotate: 360deg;
		}
	}

	.setlist {
		position: relative;
		margin: 0 -28px;
		min-height: 96px;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 28px;
		background: var(--paper);
		border-top: 3px solid var(--ink);
		z-index: 20;
	}
	.setlist ol {
		display: flex;
		align-items: center;
		gap: 12px;
		list-style: none;
		margin: 0;
		padding: 4px 4px 8px;
		overflow-x: auto;
	}
	.set-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		flex: none;
		width: 210px;
		padding: 6px 10px 6px 6px;
		background: var(--cream);
		border: 2.5px solid var(--ink);
		border-radius: 14px;
		box-shadow: 3px 3px 0 var(--ink);
		cursor: grab;
		animation: pop 0.4s cubic-bezier(0.3, 1.8, 0.5, 1);
		transition:
			translate 0.15s,
			opacity 0.15s;
	}
	.set-card.dragging {
		opacity: 0.4;
	}
	.set-card.drag-over {
		translate: 8px 0;
		box-shadow: -6px 0 0 var(--orange), 3px 3px 0 var(--ink);
	}
	.set-card.on-deck {
		background: var(--yellow);
		cursor: default;
	}
	.set-art {
		flex: none;
		display: block;
		width: 52px;
		height: 52px;
		border-radius: 8px;
		overflow: hidden;
		border: 2px solid var(--ink);
	}
	.set-art svg {
		display: block;
	}
	.set-text {
		display: grid;
		min-width: 0;
		line-height: 1.2;
	}
	.set-n {
		font-family: var(--display);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 1px;
		opacity: 0.6;
	}
	.set-title {
		font-weight: 700;
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.set-meta {
		font-size: 11px;
		font-weight: 700;
		opacity: 0.7;
	}
	.set-remove {
		position: absolute;
		top: -9px;
		right: -9px;
		width: 24px;
		height: 24px;
		padding: 0;
		font-size: 12px;
		line-height: 1;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: var(--paper);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.set-card:hover .set-remove,
	.set-remove:focus-visible {
		opacity: 1;
	}
	.setlist li.placeholder {
		padding: 8px 16px;
		background: var(--paper);
		border: 2.5px dashed var(--ink);
		border-radius: 99px;
		font-weight: 700;
		font-size: 14px;
	}
	@keyframes pop {
		from {
			scale: 0;
		}
	}

	.loader {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 16px;
		font-family: var(--display);
		font-weight: 800;
		font-size: 22px;
	}
	.loader p {
		margin: 0;
	}
	.loader-record {
		filter: drop-shadow(6px 8px 0 #1a142355);
	}
	.sleeve-eq {
		position: absolute;
		top: 14px;
		left: 14px;
		display: inline-flex;
		align-items: end;
		gap: 3px;
		height: 24px;
		padding: 4px 6px;
		background: var(--paper);
		border: 2px solid var(--ink);
		border-radius: 8px;
		box-sizing: content-box;
	}
	.sleeve-eq i {
		width: 4px;
		background: var(--ink);
		border-radius: 2px;
		animation: eq 0.5s ease-in-out infinite alternate;
	}
	.sleeve-eq i:nth-child(2) {
		animation-delay: -0.2s;
	}
	.sleeve-eq i:nth-child(3) {
		animation-delay: -0.35s;
	}
	.sleeve-eq i:nth-child(4) {
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

	.crate {
		position: fixed;
		inset: auto 0 0 0;
		height: min(78vh, 720px);
		background: var(--yellow);
		border-top: 4px solid var(--ink);
		border-radius: 36px 36px 0 0;
		box-shadow: 0 -10px 0 #1a142322;
		padding: 24px 28px;
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 18px;
		z-index: 30;
		animation: slide-up 0.5s cubic-bezier(0.3, 1.3, 0.5, 1);
	}
	@keyframes slide-up {
		from {
			translate: 0 100%;
		}
	}
	.crate-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 18px;
	}
	.crate-head h2 {
		font-family: var(--display);
		font-weight: 900;
		font-size: 44px;
		margin: 0;
	}
	.crate-head input {
		flex: 1;
		max-width: 420px;
		font: inherit;
		font-size: 20px;
		padding: 12px 18px;
		border: 3px solid var(--ink);
		border-radius: 16px;
		background: var(--paper);
	}
	.close {
		margin-left: auto;
		width: 54px;
		height: 54px;
		border-radius: 50%;
		border: 3px solid var(--ink);
		background: var(--paper);
		font-size: 22px;
		cursor: pointer;
	}
	.sleeves {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		grid-auto-rows: max-content;
		gap: 22px;
		overflow-y: auto;
		padding: 6px 6px 30px;
	}
	.sleeve {
		position: relative;
		display: grid;
		gap: 2px;
		text-align: left;
		padding: 14px;
		background: hsl(var(--h) 70% 80%);
		border: 3px solid var(--ink);
		border-radius: 14px;
		box-shadow: 5px 5px 0 var(--ink);
		cursor: pointer;
		overflow: hidden;
		transition:
			translate 0.2s cubic-bezier(0.3, 1.6, 0.5, 1),
			rotate 0.2s;
	}
	.sleeve:hover {
		translate: 0 -8px;
		rotate: -2deg;
	}
	.peek {
		display: block;
		justify-self: center;
		transition: translate 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	.sleeve:hover .peek {
		translate: 0 -6px;
		animation: wobble 0.6s ease-in-out;
	}
	@keyframes wobble {
		50% {
			rotate: 20deg;
		}
	}
	.sleeve-title {
		font-family: var(--display);
		font-weight: 800;
		font-size: 15px;
		line-height: 1.15;
		margin-top: 8px;
	}
	.sleeve-meta {
		font-size: 13px;
	}
	.sleeve-tags {
		font-size: 12px;
		font-weight: 700;
		opacity: 0.7;
	}
	.sleeve-badge {
		position: absolute;
		top: 10px;
		right: 10px;
		font-family: var(--display);
		font-weight: 800;
		font-size: 14px;
		padding: 4px 10px;
		background: var(--paper);
		border: 2.5px solid var(--ink);
		border-radius: 99px;
		rotate: 4deg;
	}
	.sleeve-badge.mix {
		background: var(--teal);
	}
	.sleeve-badge.on-deck {
		background: var(--orange);
		color: var(--paper);
	}
	.sort {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		font-size: 16px;
		cursor: pointer;
		user-select: none;
	}
	.sort strong {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sort input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.switch {
		position: relative;
		width: 58px;
		height: 32px;
		flex: none;
		background: var(--paper);
		border: 3px solid var(--ink);
		border-radius: 99px;
		transition: background 0.2s;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		background: var(--ink);
		border-radius: 50%;
		transition: translate 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	.sort input:checked + .switch {
		background: var(--orange);
	}
	.sort input:checked + .switch::after {
		translate: 26px 0;
		background: var(--paper);
	}
	.sort input:focus-visible + .switch {
		outline: 3px dashed var(--ink);
		outline-offset: 3px;
	}

	@media (max-width: 1000px) {
		.page {
			height: auto;
			min-height: 100vh;
			overflow: visible;
		}
		main {
			grid-template-columns: 1fr;
		}
		.stage {
			height: auto;
			aspect-ratio: 1;
		}
		aside {
			justify-self: center;
		}
	}
	@media (max-width: 600px) {
		.page {
			padding: 16px 16px 0;
		}
		.setlist {
			margin: 0 -16px;
		}
		.crate-head h2 {
			font-size: 30px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(*) {
			animation-duration: 0.01ms !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
