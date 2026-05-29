<script lang="ts">
	import '../app.css';
	// 2026-05-29 (ADR 0006 — full IBM Carbon adoption): load Carbon's `all.css`
	// (NOT a per-theme file). all.css defines the 457 `--cds-*` custom properties
	// on :root + `[theme=...]` overrides, so the whole app can consume
	// `var(--cds-*)` directly. The dark theme is selected via `theme="g100"` on
	// <html> (see src/app.html). Per-theme files (g100.css) bake literal hex and
	// do NOT expose `--cds-*`, so they cannot back a token-based migration.
	import 'carbon-components-svelte/css/all.css';
	// spec 026 Phase 1 — Lunaris-on-Carbon theme overlay (currently a stub
	// with no @carbon/styles imports; subsequent commits add per-component
	// imports). Loaded AFTER carbon g100 so Lunaris token overrides cascade.
	import '$lib/styles/lunaris-carbon-theme.scss';

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
