<script lang="ts">
	import { type VisibilityMode, visibilityMode } from '$lib/map/visibility-engine.svelte';
	import {
		activeBands,
		layerVisibility,
		toggleBand,
		toggleLayerVisibility
	} from '$lib/stores/dashboard/dashboard-store.svelte';
	import { signalBands } from '$lib/utils/signal-utils';

	import SessionSelector from './SessionSelector.svelte';

	function setVisibilityMode(mode: VisibilityMode) {
		visibilityMode.set(mode);
	}
</script>

<div class="layers-view">
	<!--
		RF Visualization session scope — above the visibility filter
		because it's the "which data" question, vs the other sections'
		"how to render the data" question.
	-->
	<section class="panel-section">
		<SessionSelector />
	</section>

	<!-- Visibility Filter -->
	<section class="panel-section">
		<div class="section-label">VISIBILITY FILTER</div>
		<div class="vis-options">
			<button
				class="vis-btn"
				class:active={visibilityMode.current === 'dynamic'}
				onclick={() => setVisibilityMode('dynamic')}
				title="Auto-squelch noise"
			>
				<span class="vis-icon">D</span>
				<span class="vis-name">Dynamic</span>
			</button>
			<button
				class="vis-btn"
				class:active={visibilityMode.current === 'all'}
				onclick={() => setVisibilityMode('all')}
				title="Show all detections"
			>
				<span class="vis-icon">A</span>
				<span class="vis-name">All</span>
			</button>
			<button
				class="vis-btn"
				class:active={visibilityMode.current === 'manual'}
				onclick={() => setVisibilityMode('manual')}
				title="Manually promoted only"
			>
				<span class="vis-icon">M</span>
				<span class="vis-name">Manual</span>
			</button>
		</div>
	</section>

	<!-- Map Layers -->
	<section class="panel-section">
		<div class="section-label">MAP LAYERS</div>

		<label class="toggle-row">
			<span class="toggle-label">Device Dots</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.deviceDots}
				onclick={() => toggleLayerVisibility('deviceDots')}
				role="switch"
				aria-checked={layerVisibility.current.deviceDots}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Military Symbols</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.milSyms}
				onclick={() => toggleLayerVisibility('milSyms')}
				role="switch"
				aria-checked={layerVisibility.current.milSyms}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Connections</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.connectionLines}
				onclick={() => toggleLayerVisibility('connectionLines')}
				role="switch"
				aria-checked={layerVisibility.current.connectionLines}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Cell Towers</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.cellTowers}
				onclick={() => toggleLayerVisibility('cellTowers')}
				role="switch"
				aria-checked={layerVisibility.current.cellTowers}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Signal Markers</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.signalMarkers}
				onclick={() => toggleLayerVisibility('signalMarkers')}
				role="switch"
				aria-checked={layerVisibility.current.signalMarkers}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">RF Propagation</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.rfPropagation}
				onclick={() => toggleLayerVisibility('rfPropagation')}
				role="switch"
				aria-checked={layerVisibility.current.rfPropagation}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">RF Drive Path</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.rfDrivePath}
				onclick={() => toggleLayerVisibility('rfDrivePath')}
				role="switch"
				aria-checked={layerVisibility.current.rfDrivePath}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">AP Centroids</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.rfApCentroid}
				onclick={() => toggleLayerVisibility('rfApCentroid')}
				role="switch"
				aria-checked={layerVisibility.current.rfApCentroid}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">RSSI Heatmap</span>
			<button
				class="toggle-switch"
				class:on={layerVisibility.current.rfHeatmap}
				onclick={() => toggleLayerVisibility('rfHeatmap')}
				role="switch"
				aria-checked={layerVisibility.current.rfHeatmap}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
	</section>

	<!-- Signal Strength Filter -->
	<section class="panel-section">
		<div class="section-label">SIGNAL STRENGTH</div>

		{#each signalBands as band (band.key)}
			<label class="toggle-row">
				<div class="band-label">
					<span class="band-dot" style="background: var({band.cssVar})"></span>
					<span class="toggle-label">{band.name}</span>
					<span class="band-range">{band.range}</span>
				</div>
				<button
					class="toggle-switch"
					class:on={activeBands.current.has(band.key)}
					onclick={() => toggleBand(band.key)}
					role="switch"
					aria-checked={activeBands.current.has(band.key)}
				>
					<span class="toggle-knob"></span>
				</button>
			</label>
		{/each}

		<label class="toggle-row">
			<div class="band-label">
				<span class="band-dot" style="background: var(--cds-text-helper)"></span>
				<span class="toggle-label">No RSSI</span>
			</div>
			<button
				class="toggle-switch"
				class:on={activeBands.current.has('none')}
				onclick={() => toggleBand('none')}
				role="switch"
				aria-checked={activeBands.current.has('none')}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
	</section>
</div>

<style>
	@import './map-settings-shared.css';

	.layers-view {
		display: flex;
		flex-direction: column;
	}
</style>
