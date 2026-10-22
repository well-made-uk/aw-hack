<script>
	import favicon from '#lib/assets/favicon.svg';

	/** @type {{children: import('svelte').Snippet}} */
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800;900&family=Space+Grotesk:wght@400;500;700&display=swap"
		rel="stylesheet"
	/>
	<title>Next Track</title>
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--ink: #1a1423;
		--paper: #fff6e9;
		--cream: #f4e9d6;
		--orange: #ff5a36;
		--yellow: #ffcc33;
		--pink: #ff8fc2;
		--blue: #3d4bff;
		--teal: #2ec4b6;
		--display: 'Unbounded', system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: var(--cream);
		color: var(--ink);
		font-family: 'Space Grotesk', system-ui, sans-serif;
		overflow-x: hidden;
	}
	:global(button) {
		font: inherit;
		color: inherit;
	}
</style>
