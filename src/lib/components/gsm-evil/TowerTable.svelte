<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import { onDestroy, onMount } from 'svelte';

	import PanelEmptyState from '$lib/components/ui/PanelEmptyState.svelte';
	import type { TowerGroup } from '$lib/utils/gsm-tower-utils';
	import { sortTowers } from '$lib/utils/gsm-tower-utils';

	let {
		groupedTowers = [],
		towerLookupAttempted = {},
		selectedFrequency = ''
	}: {
		groupedTowers: TowerGroup[];
		towerLookupAttempted: Record<string, boolean>;
		selectedFrequency: string;
	} = $props();

	let expandedTowers = $state<Set<string>>(new Set());
	let timestampTicker = $state(0);
	let timestampInterval: ReturnType<typeof setInterval>;

	type SortColumn =
		| 'carrier'
		| 'country'
		| 'location'
		| 'lac'
		| 'mccMnc'
		| 'devices'
		| 'lastSeen';
	let sortColumn = $state<SortColumn>('devices');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	onMount(() => {
		timestampInterval = setInterval(() => {
			timestampTicker++;
		}, 10000);
	});

	onDestroy(() => {
		if (timestampInterval) clearInterval(timestampInterval);
	});

	let sortedTowers = $derived(sortTowers([...groupedTowers], sortColumn, sortDirection));

	const columns: { col: SortColumn; label: string }[] = [
		{ col: 'carrier', label: 'Carrier' },
		{ col: 'country', label: 'Country' },
		{ col: 'location', label: 'Cell Tower Location' },
		{ col: 'lac', label: 'LAC/CI' },
		{ col: 'mccMnc', label: 'MCC-MNC' },
		{ col: 'devices', label: 'Devices' },
		{ col: 'lastSeen', label: 'Last Seen' }
	];

	/** Columns that default to descending sort order. */
	const DESC_DEFAULT_COLS = new Set<SortColumn>(['devices', 'lastSeen']);

	function handleSort(column: SortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortColumn = column;
		sortDirection = DESC_DEFAULT_COLS.has(column) ? 'desc' : 'asc';
	}

	function toggleTowerExpansion(towerId: string) {
		if (expandedTowers.has(towerId)) {
			expandedTowers.delete(towerId);
		} else {
			expandedTowers.add(towerId);
		}
		expandedTowers = new Set(expandedTowers);
	}

	/** Parse a timestamp string that may be in "HH:MM:SS YYYY-MM-DD" or ISO format. */
	function parseTimestamp(timestamp: string): Date {
		if (timestamp.includes(' ') && timestamp.split(' ').length === 2) {
			const [time, dateStr] = timestamp.split(' ');
			return new Date(`${dateStr}T${time}`);
		}
		return new Date(timestamp);
	}

	/** Format seconds elapsed as a relative time string. */
	const TIMESTAMP_THRESHOLDS: [number, (s: number) => string][] = [
		[
			86400,
			(s) => {
				const d = new Date(Date.now() - s * 1000);
				const timeStr = d.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				});
				const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
				return `${dateStr} ${timeStr}`;
			}
		],
		[3600, (s) => `${Math.floor(s / 3600)}h ago`],
		[60, (s) => `${Math.floor(s / 60)}m ago`]
	];

	function formatElapsedTime(secs: number): string {
		const match = TIMESTAMP_THRESHOLDS.find(([min]) => secs >= min);
		return match ? match[1](secs) : `${secs}s ago`;
	}

	function formatTimestamp(timestamp: string): string {
		void timestampTicker;
		const date = parseTimestamp(timestamp);
		if (isNaN(date.getTime())) return timestamp;
		return formatElapsedTime(Math.floor((Date.now() - date.getTime()) / 1000));
	}
</script>

<div class="tower-card">
	<h4 class="tower-title"><span class="tower-title-accent">IMSI</span> Capture</h4>
	<div class="tower-table-wrap">
		{#if sortedTowers.length > 0}
			<table class="tower-table">
				<thead>
					<tr>
						<th class="col-expand"></th>
						{#each columns as item (item.col)}
							<th class="col-head">
								<button class="sort-btn" onclick={() => handleSort(item.col)}>
									{item.label}
									{#if sortColumn === item.col}
										<span class="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>
									{/if}
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedTowers as tower (`${tower.mccMnc}-${tower.lac}-${tower.ci}`)}
						{@const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`}
						{@const isExpanded = expandedTowers.has(towerId)}
						<tr
							class="tower-row"
							class:expanded={isExpanded}
							onclick={() => toggleTowerExpansion(towerId)}
						>
							<td class="cell-expand">{isExpanded ? '▼' : '▶'}</td>
							<td class="cell-carrier" class:unknown={tower.carrier === 'Unknown'}>
								{tower.carrier}
							</td>
							<td class="cell-country">
								{tower.country.flag}
								{tower.country.code}
							</td>
							<td class="cell-loc">
								{#if tower.location}
									<span class="loc-coords"
										>{tower.location.lat.toFixed(4)}, {tower.location.lon.toFixed(4)}</span
									>
								{:else if !towerLookupAttempted[towerId]}
									<Tag type="outline" size="sm" class="lookup-tag">Looking up...</Tag>
								{:else}
									<span class="cell-muted">Roaming</span>
								{/if}
							</td>
							<td class="cell-lacci" class:unknown={tower.carrier === 'Unknown'}>
								{tower.lac}/{tower.ci}
							</td>
							<td class="cell-mccmnc" class:unknown={tower.carrier === 'Unknown'}>
								{tower.mccMnc}
							</td>
							<td class="cell-count">{tower.count}</td>
							<td class="cell-lastseen">{formatTimestamp(tower.lastSeen.toISOString())}</td>
						</tr>
						{#if isExpanded}
							<tr class="detail-row">
								<td colspan={8} class="detail-cell">
									<div class="detail-box">
										<div class="detail-head">
											<span class="detail-imsi">IMSI</span>
											<span class="detail-tmsi">TMSI</span>
											<span class="detail-detected">Detected</span>
										</div>
										{#each tower.devices.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) as device (device.imsi)}
											<div class="detail-row-item">
												<span class="detail-imsi">{device.imsi}</span>
												<span class="detail-tmsi">{device.tmsi || 'N/A'}</span>
												<span class="detail-detected detail-detected-val">
													{formatTimestamp(device.timestamp)}
												</span>
											</div>
										{/each}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		{:else}
			<PanelEmptyState
				title="No IMSIs captured yet"
				description="IMSI sniffer is active on {selectedFrequency} MHz — mobile devices will appear here as they attach."
			/>
		{/if}
	</div>
</div>

<style>
	/* Domain data colors (carrier/IMSI/TMSI/location categorization) are kept
	   as literal hex per the data-viz domain rule (charts phase). */
	.tower-card {
		margin: 0.5rem 1rem 0;
		padding: 1rem;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 0.5rem;
	}

	.tower-title {
		margin: 0 0 1rem;
		text-align: center;
		font-size: 1rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		color: var(--cds-text-primary);
	}

	.tower-title-accent {
		color: var(--cds-support-error);
	}

	.tower-table-wrap {
		overflow-x: auto;
		border: 1px solid var(--cds-border-subtle);
		border-radius: 0.25rem;
	}

	.tower-table {
		width: 100%;
		border-collapse: collapse;
	}

	.col-expand {
		width: 2rem;
	}

	.col-head {
		text-align: left;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		padding: 0.25rem 0.5rem;
	}

	.sort-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.25rem;
		background: transparent;
		border: none;
		font-family: var(--cds-code-01-font-family);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--cds-text-helper);
		cursor: pointer;
	}

	.sort-btn:hover {
		color: var(--cds-text-primary);
	}

	.sort-arrow {
		font-size: 0.7rem;
		color: #60a5fa;
	}

	.tower-row {
		cursor: pointer;
		border-left: 3px solid transparent;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;
	}

	.tower-row:hover {
		background: color-mix(in srgb, var(--cds-layer) 30%, transparent);
		border-left-color: #3b82f6;
	}

	.tower-row.expanded {
		border-left-color: #3b82f6;
		background: color-mix(in srgb, #3b82f6 15%, transparent);
	}

	.tower-row td {
		padding: 0.375rem 0.5rem;
	}

	.cell-expand {
		width: 2rem;
		color: #3b82f6;
		font-size: 0.7rem;
	}

	.cell-carrier {
		font-family: var(--cds-code-01-font-family);
		font-weight: 500;
		color: var(--cds-text-primary);
	}

	.cell-country {
		font-size: 0.75rem;
		color: var(--cds-text-primary);
	}

	.cell-loc {
		font-family: var(--cds-code-01-font-family);
		font-size: 0.75rem;
		color: var(--cds-text-helper);
	}

	.loc-coords {
		color: #4ade80;
	}

	.cell-muted {
		color: var(--cds-text-helper);
		font-size: 0.75rem;
	}

	.cell-lacci,
	.cell-mccmnc {
		font-family: var(--cds-code-01-font-family);
		font-size: 0.75rem;
		color: var(--cds-text-helper);
	}

	.cell-mccmnc {
		font-family: inherit;
	}

	.cell-carrier.unknown,
	.cell-lacci.unknown,
	.cell-mccmnc.unknown {
		color: #eab308;
	}

	.cell-count {
		font-weight: 600;
		color: #3b82f6;
	}

	.cell-lastseen {
		font-family: var(--cds-code-01-font-family);
		font-size: 0.75rem;
		color: var(--cds-text-helper);
	}

	.detail-row {
		background: color-mix(in srgb, var(--cds-background) 50%, transparent);
	}

	.detail-cell {
		padding: 0;
	}

	.detail-box {
		margin: 0.5rem 0 0.5rem 1.5rem;
		padding: 0.75rem;
		border-left: 3px solid #3b82f6;
		border-radius: 0.25rem;
	}

	.detail-head {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 0.5rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid var(--cds-border-subtle);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--cds-text-helper);
	}

	.detail-row-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0;
		font-family: var(--cds-code-01-font-family);
		font-size: 0.75rem;
		border-bottom: 1px solid color-mix(in srgb, var(--cds-border-subtle) 30%, transparent);
	}

	.detail-row-item:last-child {
		border-bottom: 0;
	}

	.detail-imsi {
		flex: 2;
		color: #10b981;
	}

	.detail-tmsi {
		flex: 1;
		color: #60a5fa;
	}

	.detail-detected {
		flex: 1;
		text-align: right;
	}

	.detail-detected-val {
		color: var(--cds-text-helper);
	}
</style>
