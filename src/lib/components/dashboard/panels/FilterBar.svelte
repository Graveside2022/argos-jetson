<!--
	PR-4b FilterBar — narrows the Flying-Squirrel RF layers by source
	(kismet / bluedragon / gsm-evil) and RSSI floor (dBm). Writes into the
	rfVisualization store's filters and triggers a reload on change.
-->
<script lang="ts">
	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';

	let source = $state<string>('');
	let rssiFloor = $state<string>('');

	function parseFloor(raw: string): number | undefined {
		const n = Number(raw);
		return raw.trim() === '' || !Number.isFinite(n) ? undefined : n;
	}

	async function applyFilters(): Promise<void> {
		rfVisualization.setFilters({
			source: source || undefined,
			rssiFloorDbm: parseFloor(rssiFloor)
		});
		await rfVisualization.load();
	}

	async function clearFilters(): Promise<void> {
		source = '';
		rssiFloor = '';
		rfVisualization.setFilters({ source: undefined, rssiFloorDbm: undefined });
		await rfVisualization.load();
	}
</script>

<div class="filter-bar">
	<div class="label-row">
		<span class="fb-label">FILTERS</span>
		<button type="button" class="fb-clear" onclick={() => void clearFilters()}>clear</button>
	</div>

	<div class="field">
		<label for="fb-source">Source</label>
		<select
			id="fb-source"
			bind:value={source}
			onchange={() => void applyFilters()}
			class="fb-select"
		>
			<option value="">any</option>
			<option value="kismet">kismet</option>
			<option value="bluedragon">bluedragon</option>
			<option value="gsm-evil">gsm-evil</option>
			<option value="hackrf">hackrf</option>
			<option value="rtl-sdr">rtl-sdr</option>
		</select>
	</div>

	<div class="field">
		<label for="fb-rssi">RSSI floor (dBm)</label>
		<input
			id="fb-rssi"
			type="number"
			inputmode="numeric"
			step="1"
			min="-120"
			max="0"
			placeholder="-70"
			bind:value={rssiFloor}
			onblur={() => void applyFilters()}
			class="fb-input"
		/>
	</div>
</div>

<style>
	.filter-bar {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		padding: 0.5em 0.75em;
		font-family: 'Fira Code', ui-monospace, monospace;
	}
	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5em;
	}
	.fb-label {
		font-size: 0.68em;
		letter-spacing: 0.1em;
		color: var(--muted-foreground);
	}
	.fb-clear {
		font-size: 0.68em;
		background: transparent;
		color: var(--muted-foreground);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0.1em 0.5em;
		font-family: inherit;
		cursor: pointer;
	}
	.fb-clear:hover {
		color: var(--foreground);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2em;
	}
	.field label {
		font-size: 0.68em;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}
	.fb-select,
	.fb-input {
		background: var(--card);
		color: var(--foreground);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0.3em 0.45em;
		font-size: 0.82em;
		font-family: inherit;
	}
	.fb-select:focus,
	.fb-input:focus {
		outline: none;
		border-color: var(--primary);
	}
</style>
