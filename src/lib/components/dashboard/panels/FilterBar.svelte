<!--
	PR-4b FilterBar — narrows the Flying-Squirrel RF layers by source
	(kismet / bluedragon / gsm-evil) and RSSI floor (dBm). Writes into the
	rfVisualization store's filters and triggers a reload on change.
-->
<script lang="ts">
	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';

	type PanelState =
		| 'Empty'
		| 'Loading'
		| 'Default'
		| 'Active'
		| 'Error'
		| 'Success'
		| 'Disabled'
		| 'Disconnected';

	/** Typed error so callers/UI can surface a corrective action rather than a swallowed string. */
	class ParseError extends Error {
		readonly field: string;
		constructor(message: string, field: string) {
			super(message);
			this.name = 'ParseError';
			this.field = field;
		}
	}

	let source = $state<string>('');
	let rssiFloor = $state<string>('');
	let panelState = $state<PanelState>('Default');
	let errorMessage = $state<string>('');

	const isBusy = $derived(panelState === 'Loading' || panelState === 'Disabled');
	const hasActiveFilters = $derived(source !== '' || rssiFloor.trim() !== '');

	function parseFloor(raw: string): number | undefined {
		const trimmed = raw.trim();
		if (trimmed === '') return undefined;
		const n = Number(trimmed);
		if (!Number.isFinite(n)) {
			throw new ParseError(
				`RSSI floor "${raw}" is not a number — enter a value like -70`,
				'rssiFloor'
			);
		}
		return n;
	}

	async function runReload(activeAfter: boolean): Promise<void> {
		panelState = 'Loading';
		errorMessage = '';
		try {
			await rfVisualization.load();
			panelState = activeAfter ? 'Active' : 'Success';
		} catch (err) {
			panelState = 'Error';
			errorMessage =
				err instanceof Error
					? err.message
					: 'Failed to apply filters — check the RF API and retry.';
			// Re-throw so callers can chain logic on failure if needed.
			throw err;
		}
	}

	async function applyFilters(): Promise<void> {
		try {
			const rssiFloorDbm = parseFloor(rssiFloor);
			rfVisualization.setFilters({
				source: source || undefined,
				rssiFloorDbm
			});
			await runReload(hasActiveFilters);
		} catch (err) {
			if (err instanceof ParseError) {
				panelState = 'Error';
				errorMessage = err.message;
				return;
			}
			// Reload errors already set state in runReload — swallow at the
			// boundary so unhandled rejections don't surface in the console.
		}
	}

	async function clearFilters(): Promise<void> {
		source = '';
		rssiFloor = '';
		rfVisualization.setFilters({ source: undefined, rssiFloorDbm: undefined });
		try {
			await runReload(false);
		} catch {
			/* state already set in runReload */
		}
	}
</script>

<div class="filter-bar" data-state={panelState}>
	<div class="label-row">
		<span class="fb-label">FILTERS</span>
		<button
			type="button"
			class="fb-clear"
			disabled={isBusy}
			onclick={() => void clearFilters()}
		>
			{panelState === 'Loading' ? 'loading…' : 'clear'}
		</button>
	</div>

	<div class="field">
		<label for="fb-source">Source</label>
		<select
			id="fb-source"
			bind:value={source}
			disabled={isBusy}
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
			disabled={isBusy}
			onblur={() => void applyFilters()}
			class="fb-input"
		/>
	</div>

	{#if panelState === 'Error' && errorMessage}
		<p class="fb-error" role="alert">{errorMessage}</p>
	{/if}
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
	.fb-select:disabled,
	.fb-input:disabled,
	.fb-clear:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.fb-error {
		font-size: 0.7em;
		color: var(--error-desat);
		margin: 0;
		padding: 0.2em 0;
		font-family: inherit;
	}
</style>
