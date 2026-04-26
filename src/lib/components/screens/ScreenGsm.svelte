<script lang="ts">
	// spec-024 PR10b T052 — Mk II GSM screen.
	//
	// Composes the FrequencyTuner top-bar, ImsiTable left, and
	// GsmInspector right inside the chassis main slot. All three
	// children read from the gsmStore runes singleton; the screen
	// only owns lifecycle (start/stop polling).

	import { onDestroy, onMount } from 'svelte';

	import FrequencyTuner from '$lib/components/screens/parts/FrequencyTuner.svelte';
	import GsmInspector from '$lib/components/screens/parts/GsmInspector.svelte';
	import ImsiTable from '$lib/components/screens/parts/ImsiTable.svelte';
	import { gsmStore } from '$lib/state/gsm.svelte';

	onMount(() => gsmStore.start());
	onDestroy(() => gsmStore.stop());
</script>

<div class="gsm-screen" data-screen="gsm">
	<FrequencyTuner />
	<div class="gsm-grid">
		<ImsiTable />
		<GsmInspector />
	</div>
</div>

<style>
	.gsm-screen {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		min-width: 0;
		font-family: 'Fira Code', monospace;
	}
	.gsm-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 280px;
		gap: 12px;
		padding: 12px;
		flex: 1;
		min-height: 0;
	}
</style>
