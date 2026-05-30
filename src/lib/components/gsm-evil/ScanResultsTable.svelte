<script lang="ts">
	import { Button } from 'carbon-components-svelte';

	import type { ScanResult } from '$lib/stores/gsm-evil-store.svelte';

	let {
		scanResults = [],
		selectedFrequency = '',
		onselect
	}: {
		scanResults: ScanResult[];
		selectedFrequency: string;
		onselect: (frequency: string) => void;
	} = $props();

	// Signal-quality domain colors are kept literal (data-viz domain rule); each
	// strength maps to a scoped class defined in the style block below.
	const QUALITY_CLASSES: Record<string, string> = {
		excellent: 'q-excellent',
		'very strong': 'q-excellent',
		strong: 'q-strong',
		good: 'q-good',
		moderate: 'q-moderate',
		weak: 'q-weak'
	};

	function getQualityClass(strength: string): string {
		return QUALITY_CLASSES[strength.toLowerCase()] ?? 'q-unknown';
	}
</script>

<div class="results-card">
	<h4 class="results-title"><span class="results-title-accent">Scan</span> Results</h4>
	<div class="table-container">
		{#if scanResults.length > 0}
			<table class="results-table">
				<thead>
					<tr>
						<th class="rh">Frequency</th>
						<th class="rh">Signal</th>
						<th class="rh">Quality</th>
						<th class="rh">Channel Type</th>
						<th class="rh rh-center">GSM Frames</th>
						<th class="rh rh-center">Activity</th>
						<th class="rh">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each scanResults.sort((a, b) => (b.frameCount || 0) - (a.frameCount || 0)) as result (result.frequency)}
						<tr
							class="results-row"
							class:row-selected={selectedFrequency === result.frequency}
						>
							<td class="cell-freq">{result.frequency} MHz</td>
							<td class="cell-signal">
								{result.power !== undefined && result.power > -100
									? result.power.toFixed(1) + ' dBm'
									: result.strength || 'N/A'}
							</td>
							<td>
								<span class="qual-tag {getQualityClass(result.strength)}"
									>{result.strength}</span
								>
							</td>
							<td>
								{#if result.channelType}
									<span
										class="chan-tag"
										class:chan-control={result.controlChannel}
									>
										{result.channelType}
									</span>
								{:else}
									<span class="cell-muted">-</span>
								{/if}
							</td>
							<td class="cell-center">
								{#if result.frameCount !== undefined}
									<span class="frame-count">{result.frameCount}</span>
								{:else}
									<span class="cell-muted cell-italic">-</span>
								{/if}
							</td>
							<td class="cell-center">
								{#if result.hasGsmActivity}
									<span class="act-yes">✓</span>
								{:else}
									<span class="act-no">✗</span>
								{/if}
							</td>
							<td>
								<Button
									kind={selectedFrequency === result.frequency
										? 'primary'
										: 'tertiary'}
									size="small"
									on:click={() => onselect(result.frequency)}
									disabled={selectedFrequency === result.frequency}
								>
									{selectedFrequency === result.frequency ? 'Selected' : 'Select'}
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="results-empty">
				<p class="cell-muted">No results available</p>
			</div>
		{/if}
	</div>
	{#if scanResults.length > 0}
		<p class="results-footer">
			Found {scanResults.length} active frequencies • Sorted by GSM frame count
		</p>
	{/if}
</div>

<style>
	/* Signal-quality + channel colors are literal hex (data-viz domain, charts phase). */
	.results-card {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 0.5rem;
	}

	.results-title {
		margin: 0 0 1rem;
		text-align: center;
		font-size: 1rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		color: var(--cds-text-primary);
	}

	.results-title-accent {
		color: var(--cds-support-error);
	}

	.table-container {
		overflow-x: auto;
		overflow-y: auto;
		border-radius: 0.375rem;
		border: 1px solid var(--cds-border-subtle);
		min-height: 300px;
		max-height: 400px;
	}

	.results-table {
		width: 100%;
		border-collapse: collapse;
	}

	.rh {
		text-align: left;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		color: var(--cds-text-helper);
		padding: 0.5rem;
	}

	.rh-center {
		text-align: center;
	}

	.results-row td {
		padding: 0.5rem;
	}

	.results-row.row-selected {
		background: color-mix(in srgb, #22c55e 10%, transparent);
		box-shadow: inset 2px 0 0 #4ade80;
	}

	.cell-freq {
		font-family: var(--cds-code-01-font-family);
		font-weight: 600;
		color: var(--cds-text-primary);
	}

	.cell-signal {
		font-family: var(--cds-code-01-font-family);
		color: var(--cds-text-helper);
	}

	.cell-muted {
		color: var(--cds-text-helper);
	}

	.cell-italic {
		font-style: italic;
	}

	.cell-center {
		text-align: center;
	}

	.frame-count {
		font-family: var(--cds-code-01-font-family);
		font-weight: 600;
		color: #60a5fa;
	}

	.act-yes {
		font-size: 1.125rem;
		font-weight: 700;
		color: #4ade80;
	}

	.act-no {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f87171;
	}

	.qual-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem 0.5rem;
		border-radius: 0.375rem;
		border: 1px solid;
		font-size: 0.75rem;
	}

	.q-excellent {
		background: color-mix(in srgb, #22c55e 20%, transparent);
		color: #4ade80;
		border-color: color-mix(in srgb, #22c55e 30%, transparent);
	}

	.q-strong {
		background: color-mix(in srgb, #10b981 20%, transparent);
		color: #34d399;
		border-color: color-mix(in srgb, #10b981 30%, transparent);
	}

	.q-good {
		background: color-mix(in srgb, #eab308 20%, transparent);
		color: #facc15;
		border-color: color-mix(in srgb, #eab308 30%, transparent);
	}

	.q-moderate {
		background: color-mix(in srgb, #f59e0b 20%, transparent);
		color: #fbbf24;
		border-color: color-mix(in srgb, #f59e0b 30%, transparent);
	}

	.q-weak {
		background: color-mix(in srgb, #ef4444 20%, transparent);
		color: #f87171;
		border-color: color-mix(in srgb, #ef4444 30%, transparent);
	}

	.q-unknown {
		background: color-mix(in srgb, #6b7280 20%, transparent);
		color: #9ca3af;
		border-color: color-mix(in srgb, #6b7280 30%, transparent);
	}

	.chan-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem 0.5rem;
		border-radius: 0.375rem;
		border: 1px solid var(--cds-border-subtle);
		font-family: var(--cds-code-01-font-family);
		font-size: 0.75rem;
		color: var(--cds-text-helper);
	}

	.chan-tag.chan-control {
		background: color-mix(in srgb, #3b82f6 20%, transparent);
		color: #60a5fa;
		border-color: color-mix(in srgb, #3b82f6 30%, transparent);
	}

	.results-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		text-align: center;
	}

	.results-footer {
		text-align: center;
		font-size: 0.75rem;
		font-style: italic;
		color: var(--cds-text-helper);
		margin-top: 1rem;
	}
</style>
