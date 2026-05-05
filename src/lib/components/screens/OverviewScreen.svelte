<script lang="ts">
	// spec-026 phase 9.4 — OVERVIEW screen reflowed for design parity.
	//
	// Layout: MissionStrip (full width) → middle row: SENSORS | DETECTIONS | SOURCES
	// → EVENT STREAM band (full width, click-to-modal). Replaces the prior 2x2
	// grid where EVENTS occupied the right column. SOURCES is the new third
	// panel on the middle row; EVENTS moves to a horizontal band beneath.

	import MissionStrip from '$lib/components/chassis/MissionStrip.svelte';
	import EventDetailModal from '$lib/components/mk2/overview/EventDetailModal.svelte';
	import EventStreamBand from '$lib/components/mk2/overview/EventStreamBand.svelte';
	import SourcesPanel from '$lib/components/mk2/overview/SourcesPanel.svelte';
	import DetectionsList from '$lib/components/screens/parts/DetectionsList.svelte';
	import OverviewSensors from '$lib/components/screens/parts/OverviewSensors.svelte';
	import { missionStore } from '$lib/state/missions.svelte';
	import type { AppEvent } from '$lib/types/event';
	import type { Mission } from '$lib/types/mission';

	type ScreenState = 'loading' | 'error' | 'empty' | 'inactive' | 'default';
	const screenState = $derived<ScreenState>(deriveScreenState());

	// fallow-ignore-next-line complexity
	function deriveScreenState(): ScreenState {
		if (!missionStore.loaded) return 'loading';
		if (missionStore.lastError !== null) return 'error';
		if (missionStore.missions.length === 0) return 'empty';
		const active: Mission | null = missionStore.active;
		return active ? 'default' : 'inactive';
	}

	let modalOpen = $state(false);
	let selectedEvent = $state<AppEvent | null>(null);

	function openEvent(evt: AppEvent): void {
		selectedEvent = evt;
		modalOpen = true;
	}

	function closeEvent(): void {
		modalOpen = false;
	}
</script>

<div class="overview-screen" data-state={screenState}>
	<MissionStrip />

	<div class="overview-grid">
		<section class="region region-sensors" aria-labelledby="sec-sensors">
			<header id="sec-sensors" class="region-label">SENSORS</header>
			<OverviewSensors />
		</section>
		<section class="region region-detections" aria-labelledby="sec-detections">
			<header id="sec-detections" class="region-label">DETECTIONS</header>
			<DetectionsList />
		</section>
		<section class="region region-sources" aria-labelledby="sec-sources">
			<SourcesPanel />
		</section>
	</div>

	<div class="overview-events">
		<EventStreamBand selectedId={selectedEvent?.id ?? null} onSelect={openEvent} />
	</div>

	<EventDetailModal bind:open={modalOpen} event={selectedEvent} onClose={closeEvent} />
</div>

<style>
	.overview-screen {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		height: 100%;
		font-family: 'Fira Code', monospace;
	}
	.overview-grid {
		display: grid;
		grid-template-columns: 1.2fr 1fr 1fr;
		gap: 12px;
		padding: 12px 12px 0;
		flex: 1;
		min-height: 0;
	}
	.overview-events {
		padding: 12px;
	}
	.region {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		background: var(--card);
		min-height: 0;
	}
	.region-sources {
		padding: 0;
		border: 0;
		background: transparent;
	}
	.region-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: var(--muted-foreground);
	}
</style>
