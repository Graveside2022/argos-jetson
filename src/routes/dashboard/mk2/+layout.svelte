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

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
	const chassis = createChassisState();

	let toolsOpen = $state(false);

	// ⌘K / Ctrl+K toggles the Tools Flyout. Skipped when the user is typing
	// in any form control so the binding doesn't steal in-flight input.
	function isFormField(t: EventTarget | null): boolean {
		if (!(t instanceof HTMLElement)) return false;
		const tag = t.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
	}

	function isCommandK(e: KeyboardEvent): boolean {
		return e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
	}

	function onKeydown(e: KeyboardEvent): void {
		if (!isCommandK(e)) return;
		if (isFormField(e.target)) return;
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
		<LeftRail toolsOpen={toolsOpen} onOpenTools={() => (toolsOpen = true)} />
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

<ToolsFlyout
	open={toolsOpen}
	catalog={mk2ToolsCatalog}
	onClose={() => (toolsOpen = false)}
/>

{#snippet weatherSlot()}
	<WeatherButton
		wx={chassis.weather.wx}
		loading={chassis.weather.loading}
		error={chassis.weather.error}
		empty={chassis.weather.wx == null && !chassis.weather.loading && chassis.weather.error == null}
	/>
{/snippet}
