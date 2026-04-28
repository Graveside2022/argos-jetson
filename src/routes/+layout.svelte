<script lang="ts">
	import '../app.css';

	// spec 026 Phase 1+ will import: '$lib/styles/lunaris-carbon-theme.scss'
	// after sass-embedded is added as a devDep (Vite v7 requirement). Phase 0
	// ships the theme file as a stub-only scaffold; no SCSS pipeline change yet.
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

	// spec-024 PR11 (T054) — Mk II is the default UI. `?ui=lunaris` is the
	// one-release escape hatch back to the legacy Lunaris shell; T055 next
	// release deletes both that escape and the legacy chassis. Reads:
	//   default                       → body[data-ui="mk2"]
	//   ?ui=lunaris                   → no data-ui attribute (Lunaris :root)
	//   ?ui=mk2 (old bookmark)        → still mk2 (idempotent)
	$effect(() => {
		const isLunaris = page.url.searchParams.get('ui') === 'lunaris';
		if (isLunaris) {
			document.body.removeAttribute('data-ui');
		} else {
			document.body.setAttribute('data-ui', 'mk2');
		}
	});

	// spec-024 PR2 T017 — Mk II tweaks: mirror accent + density stores onto
	// <body data-accent="..."> + <body data-density="..."> so the pre-wired
	// CSS selectors in app.css apply live without any component coupling.
	// Lunaris escape hatch strips both attributes so legacy mode stays clean.
	$effect(() => {
		const isLunaris = page.url.searchParams.get('ui') === 'lunaris';
		if (isLunaris) {
			document.body.removeAttribute('data-accent');
		} else {
			document.body.setAttribute('data-accent', accentStore.value);
		}
	});

	$effect(() => {
		const isLunaris = page.url.searchParams.get('ui') === 'lunaris';
		if (isLunaris) {
			document.body.removeAttribute('data-density');
		} else {
			document.body.setAttribute('data-density', densityStore.value);
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
