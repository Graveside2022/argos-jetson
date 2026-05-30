<script lang="ts">
	import '../app.css';
	// 2026-05-29 (ADR 0006 — full IBM Carbon adoption): load Carbon's `all.css`
	// (NOT a per-theme file). all.css defines the 457 `--cds-*` custom properties
	// on :root + `[theme=...]` overrides, so the whole app can consume
	// `var(--cds-*)` directly. The dark theme is selected via `theme="g100"` on
	// <html> (see src/app.html). Per-theme files (g100.css) bake literal hex and
	// do NOT expose `--cds-*`, so they cannot back a token-based migration.
	import 'carbon-components-svelte/css/all.css';
	// IBM Plex webfonts (ADR 0006). Carbon's all.css declares the Plex Sans/Mono
	// font-family stack but does NOT ship the font files — without these imports
	// the UI silently falls back to the system Helvetica/Arial stack. The
	// `-default` bundles carry exactly the weights Carbon g100 uses (300/400/600,
	// normal), not the 112-face `-all` set. Self-hosted woff2 (offline-capable on
	// the Jetson; no Google Fonts CDN dependency).
	import '@ibm/plex-sans/css/ibm-plex-sans-default.css';
	import '@ibm/plex-mono/css/ibm-plex-mono-default.css';

	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	import ToastRegion from '$lib/components/chassis/ToastRegion.svelte';
	import { markCSSLoaded } from '$lib/utils/css-loader';

	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();

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

<ToastRegion />

<main class="page-loading">
	{@render children()}
</main>
