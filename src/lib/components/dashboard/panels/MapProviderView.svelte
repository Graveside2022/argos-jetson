<script lang="ts">
	import TextInput from '$lib/components/chassis/forms/TextInput.svelte';
	import {
		DEFAULT_SATELLITE_SOURCE,
		DEFAULT_VECTOR_SOURCE,
		mapSettings
	} from '$lib/stores/dashboard/map-settings-store.svelte';

	let customUrl = $state('');
	let stadiaAvailable = $derived(mapSettings.stadiaAvailable);

	function selectVector() {
		mapSettings.setProvider(DEFAULT_VECTOR_SOURCE);
	}

	function selectSatellite() {
		mapSettings.setProvider(DEFAULT_SATELLITE_SOURCE);
	}

	function applyCustom() {
		if (!customUrl) return;
		mapSettings.setProvider({
			name: 'Custom',
			type: 'satellite',
			url: customUrl,
			attribution: 'Custom'
		});
	}
</script>

<div class="provider-view">
	<section class="panel-section">
		<div class="section-label">MAP PROVIDER</div>
		<div class="provider-grid">
			<button
				class="provider-btn"
				class:active={mapSettings.provider.type === 'vector'}
				onclick={selectVector}
				disabled={!stadiaAvailable}
				title={!stadiaAvailable ? 'Requires Stadia Maps API key' : ''}
			>
				<span class="provider-icon vector"></span>
				<span class="provider-name">Tactical</span>
			</button>
			<button
				class="provider-btn"
				class:active={mapSettings.provider.name === 'Satellite Hybrid'}
				onclick={selectSatellite}
			>
				<span class="provider-icon satellite"></span>
				<span class="provider-name">Satellite</span>
			</button>
		</div>

		<div class="custom-input-row">
			<div class="custom-input-grow">
				<TextInput
					labelText="Custom XYZ URL"
					hideLabel
					placeholder="Custom XYZ URL..."
					bind:value={customUrl}
					size="sm"
				/>
			</div>
			<button class="apply-btn" onclick={applyCustom}>Set</button>
		</div>
	</section>
</div>

<style>
	@import './map-settings-shared.css';

	.provider-view {
		display: flex;
		flex-direction: column;
	}

	.custom-input-grow {
		flex: 1;
	}
</style>
