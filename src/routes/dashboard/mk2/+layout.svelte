<script lang="ts">
	// spec-024 PR6 — Mk II app shell as a SvelteKit layout.
	//
	// Mounting the chassis here (instead of inside the dashboard page like
	// PR5b/PR5c did) lets nested routes — /dashboard/mk2/{overview,systems,
	// map} — swap content via {@render children()} while the chassis itself
	// (topbar / rail / drawer / statusbar) stays mounted. Chassis state
	// (drawer height, mission strip in-edit, weather popover) survives a
	// screen change because Svelte never unmounts the layout, only the
	// inner +page.svelte.
	//
	// Pattern reference: every enterprise SaaS console (Datadog, AWS
	// Console, Linear, Vercel) uses the same approach — persistent shell,
	// URL-as-screen-state, browser back/forward navigates between screens.

	import type { Snippet } from 'svelte';

	import Chassis from '$lib/components/chassis/Chassis.svelte';
	import Drawer from '$lib/components/chassis/Drawer.svelte';
	import LeftRail from '$lib/components/chassis/LeftRail.svelte';
	import Statusbar from '$lib/components/chassis/Statusbar.svelte';
	import Topbar from '$lib/components/chassis/Topbar.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
	// PR1 T005 keys all Mk II tokens off `body[data-ui="mk2"]`. The root
	// +layout.svelte handles the body attribute centrally based on URL
	// pathname, so this nested layout doesn't need its own toggle —
	// having two effects fighting over the same attribute would race.
</script>

<Chassis>
	{#snippet topbar()}
		<Topbar />
	{/snippet}
	{#snippet rail()}
		<LeftRail />
	{/snippet}
	{#snippet main()}
		{@render children()}
	{/snippet}
	{#snippet drawer()}
		<Drawer />
	{/snippet}
	{#snippet statusbar()}
		<Statusbar />
	{/snippet}
</Chassis>
