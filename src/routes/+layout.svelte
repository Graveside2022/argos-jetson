<script lang="ts">
	import '../app.css';

	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';

	import { page } from '$app/state';
	import { accentStore, densityStore } from '$lib/state/ui.svelte';
	import { markCSSLoaded } from '$lib/utils/css-loader';

	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();

	// spec-024 PR1 T006 — Mk II flag: ?ui=mk2 mirrors to <body data-ui="mk2">.
	// `<svelte:body>` rejects custom attrs, and hooks.server.ts is anti-scope through PR 11
	// (per spec-024 plan.md), so we toggle the attribute via $effect on the client.
	$effect(() => {
		if (page.url.searchParams.get('ui') === 'mk2') {
			document.body.setAttribute('data-ui', 'mk2');
		} else {
			document.body.removeAttribute('data-ui');
		}
	});

	// spec-024 PR2 T017 — Mk II tweaks: mirror accent + density stores onto
	// <body data-accent="..."> + <body data-density="..."> so the pre-wired
	// CSS selectors in app.css apply live without any component coupling.
	// Effects run only when the Mk II flag is on so legacy mode stays clean.
	$effect(() => {
		const isMk2 = page.url.searchParams.get('ui') === 'mk2';
		if (isMk2) {
			document.body.setAttribute('data-accent', accentStore.value);
		} else {
			document.body.removeAttribute('data-accent');
		}
	});

	$effect(() => {
		const isMk2 = page.url.searchParams.get('ui') === 'mk2';
		if (isMk2) {
			document.body.setAttribute('data-density', densityStore.value);
		} else {
			document.body.removeAttribute('data-density');
		}
	});

	// CSS loading detection to prevent FOUC
	onMount(() => {
		markCSSLoaded();
	});
</script>

<svelte:head>
	<title>Argos — SDR & Network Analysis Console</title>
	<meta
		name="description"
		content="Army EW training console for SDR signal analysis, network reconnaissance, GPS tracking, and tactical communications."
	/>
</svelte:head>

<Toaster
	theme="dark"
	position="bottom-right"
	toastOptions={{
		style: 'background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); font-family: "Fira Code", monospace; font-size: 11px;'
	}}
/>

<main class="page-loading">
	{@render children()}
</main>
