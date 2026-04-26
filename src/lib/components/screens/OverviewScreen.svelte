<script lang="ts">
	// spec-024 PR5b T034 — Mk II OVERVIEW screen.
	//
	// Top: editable MissionStrip (T030, this PR).
	// Below: placeholder regions for SensorTile×4 (T031), DetectionsList
	// (T032), and EventStream (T033) — all wired in PR5c. Empty-state
	// shells render here so reviewers can confirm the screen layout
	// without waiting on PR5c content.

	import MissionStrip from '$lib/components/chassis/MissionStrip.svelte';
</script>

<div class="overview-screen">
	<MissionStrip />

	<div class="overview-grid">
		<section class="region region-sensors" aria-labelledby="sec-sensors">
			<header id="sec-sensors" class="region-label">SENSORS</header>
			<div class="region-empty">SensorTile ×4 — pending PR5c (T031)</div>
		</section>
		<section class="region region-detections" aria-labelledby="sec-detections">
			<header id="sec-detections" class="region-label">DETECTIONS</header>
			<div class="region-empty">DetectionsList — pending PR5c (T032)</div>
		</section>
		<section class="region region-events" aria-labelledby="sec-events">
			<header id="sec-events" class="region-label">EVENTS</header>
			<div class="region-empty">EventStream — pending PR5c (T033)</div>
		</section>
	</div>
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
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'sensors    sensors'
			'detections events';
		gap: 12px;
		padding: 12px;
		flex: 1;
		min-height: 0;
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
	.region-sensors {
		grid-area: sensors;
	}
	.region-detections {
		grid-area: detections;
	}
	.region-events {
		grid-area: events;
	}
	.region-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: var(--muted-foreground);
	}
	.region-empty {
		color: var(--muted-foreground);
		font-size: 11px;
		opacity: 0.7;
	}
</style>
