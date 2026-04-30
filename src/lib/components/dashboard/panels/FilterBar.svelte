<!--
	PR-4b FilterBar — narrows the Flying-Squirrel RF layers by source
	(kismet / bluedragon / gsm-evil) and RSSI floor (dBm). Writes into the
	rfVisualization store's filters and triggers a reload on change.
-->
<script lang="ts">
	import { SelectItem } from 'carbon-components-svelte';

	import InlineNotification from '$lib/components/chassis/forms/InlineNotification.svelte';
	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import Select from '$lib/components/chassis/forms/Select.svelte';
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

	let source = $state<string>('');
	let rssiFloor = $state<number | null>(null);
	let panelState = $state<PanelState>('Default');
	let errorMessage = $state<string>('');

	const isBusy = $derived(panelState === 'Loading' || panelState === 'Disabled');
	const hasActiveFilters = $derived(source !== '' || rssiFloor !== null);

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
			rfVisualization.setFilters({
				source: source || undefined,
				rssiFloorDbm: rssiFloor ?? undefined
			});
			await runReload(hasActiveFilters);
		} catch {
			// Reload errors already set state in runReload — swallow at the
			// boundary so unhandled rejections don't surface in the console.
		}
	}

	async function clearFilters(): Promise<void> {
		source = '';
		rssiFloor = null;
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
		<Select
			id="fb-source"
			labelText="Source"
			bind:value={source}
			disabled={isBusy}
			onChange={() => void applyFilters()}
			size="sm"
		>
			<SelectItem value="" text="any" />
			<SelectItem value="kismet" text="kismet" />
			<SelectItem value="bluedragon" text="bluedragon" />
			<SelectItem value="gsm-evil" text="gsm-evil" />
			<SelectItem value="hackrf" text="hackrf" />
			<SelectItem value="rtl-sdr" text="rtl-sdr" />
		</Select>
	</div>

	<div class="field">
		<NumberInput
			id="fb-rssi"
			labelText="RSSI floor (dBm)"
			bind:value={rssiFloor}
			min={-120}
			max={0}
			step={1}
			placeholder="-70"
			disabled={isBusy}
			onBlur={() => void applyFilters()}
			size="sm"
			hideSteppers
			disableWheel
		/>
	</div>

	{#if panelState === 'Error' && errorMessage}
		<InlineNotification kind="error" title={errorMessage} hideCloseButton />
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
	.fb-clear:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
