<script lang="ts">
	// spec-024 PR6 — Mk II app shell as a SvelteKit layout.
	// spec-024 PR8 — adds Tools Flyout (⌘K launcher) to the chassis.
	//
	// Mounting the chassis here (instead of inside the dashboard page like
	// PR5b/PR5c did) lets nested routes — /dashboard/mk2/{overview,systems,
	// map,kismet,gsm,agents} — swap content via {@render children()} while
	// the chassis itself (topbar / rail / drawer / statusbar / flyout) stays
	// mounted across screen swaps. Flyout state lives here so ⌘K works from
	// every Mk II screen and the rail's `+` button hits the same handler.

	import type { Snippet } from 'svelte';

	import Chassis from '$lib/components/chassis/Chassis.svelte';
	import Drawer from '$lib/components/chassis/Drawer.svelte';
	import LeftRail from '$lib/components/chassis/LeftRail.svelte';
	import Statusbar from '$lib/components/chassis/Statusbar.svelte';
	import ToolsFlyout from '$lib/components/chassis/ToolsFlyout.svelte';
	import Topbar from '$lib/components/chassis/Topbar.svelte';
	import WeatherButton from '$lib/components/chassis/WeatherButton.svelte';
	import { mk2ToolsCatalog } from '$lib/data/mk2-tools-catalog';
	import { createChassisState } from '$lib/state/chassis.svelte';
	import { pinnedToolsStore } from '$lib/stores/dashboard/pinned-tools-store.svelte';
	import type { Mk2Tool } from '$lib/types/mk2-tool';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
	const chassis = createChassisState();

	let toolsOpen = $state(false);

	// Resolve pinned tool ids → full pinned-rail entries by looking up the
	// Mk2 catalog. External tools route to their iframe-embed URL; everything
	// else uses the canonical /dashboard/mk2/${id} path.
	function pinnedHref(tool: Mk2Tool): string {
		if (tool.action.kind === 'external') return `/dashboard/mk2/embed/${tool.id}`;
		if (tool.action.kind === 'route') return tool.action.href;
		return `/dashboard/mk2/${tool.id}`;
	}

	const pinned = $derived(
		pinnedToolsStore.ids
			.map((id) => mk2ToolsCatalog.find((t) => t.id === id))
			.filter((t): t is Mk2Tool => t !== undefined)
			.map((t) => ({ id: t.id, label: t.name, icon: t.icon, href: pinnedHref(t) }))
	);

	// ⌘K / Ctrl+K toggles the Tools Flyout. The hotkey fires regardless of
	// focus target — including inside the flyout's own search input — so
	// users can always close the launcher without first un-focusing.
	// fallow-ignore-next-line complexity
	function isCommandK(e: KeyboardEvent): boolean {
		return e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
	}

	function onKeydown(e: KeyboardEvent): void {
		if (!isCommandK(e)) return;
		e.preventDefault();
		toolsOpen = !toolsOpen;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<Chassis>
	{#snippet topbar()}
		<Topbar lat={chassis.gps.lat} lon={chassis.gps.lon} weather={weatherSlot} />
	{/snippet}
	{#snippet rail()}
		<LeftRail
			{pinned}
			{toolsOpen}
			onOpenTools={() => (toolsOpen = true)}
			onUnpin={(id) => pinnedToolsStore.unpin(id)}
		/>
	{/snippet}
	{#snippet main()}
		{@render children()}
	{/snippet}
	{#snippet drawer()}
		<Drawer />
	{/snippet}
	{#snippet statusbar()}
		<Statusbar link={chassis.link} system={chassis.system} session={chassis.session} />
	{/snippet}
</Chassis>

<ToolsFlyout open={toolsOpen} catalog={mk2ToolsCatalog} onClose={() => (toolsOpen = false)} />

{#snippet weatherSlot()}
	<WeatherButton
		wx={chassis.weather.wx}
		loading={chassis.weather.loading}
		error={chassis.weather.error}
		empty={chassis.weather.wx == null &&
			!chassis.weather.loading &&
			chassis.weather.error == null}
	/>
{/snippet}
