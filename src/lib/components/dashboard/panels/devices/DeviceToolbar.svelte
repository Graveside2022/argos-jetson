<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Band filter chips, back button use custom 24x20px sizing incompatible with shadcn Button -->
<script lang="ts">
	import ChevronLeft from 'carbon-icons-svelte/lib/ChevronLeft.svelte';
	import UserMultiple from 'carbon-icons-svelte/lib/UserMultiple.svelte';

	import Search from '$lib/components/chassis/forms/Search.svelte';
	import { kismetStore, setKismetStatus } from '$lib/stores/tactical-map/kismet-store.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { signalBands } from '$lib/utils/signal-utils';

	interface Props {
		deviceCount: number;
		renderedCount?: number;
		isolatedMAC: string | null;
		searchQuery: string;
		activeBands: Set<string>;
		shouldHideNoSignal: boolean;
		shouldShowOnlyWithClients: boolean;
		apsWithClientsCount: number;
		onClearIsolation: () => void;
		onSearchChange: (query: string) => void;
		onToggleBand: (key: string) => void;
		onToggleNoSignal: () => void;
		onToggleOnlyWithClients: () => void;
		onClearAll: () => void;
	}

	let {
		deviceCount,
		renderedCount,
		isolatedMAC,
		searchQuery,
		activeBands,
		shouldHideNoSignal,
		shouldShowOnlyWithClients,
		apsWithClientsCount,
		onClearIsolation,
		onSearchChange,
		onToggleBand,
		onToggleNoSignal,
		onToggleOnlyWithClients,
		onClearAll
	}: Props = $props();

	let kismetBusy = $state(false);

	function handleKismetResult(
		data: { success?: boolean; message?: string },
		action: string
	): void {
		if (data.success) {
			setKismetStatus(action === 'start' ? 'running' : 'stopped');
		} else {
			setKismetStatus('stopped');
			toast.error(data.message ?? 'Kismet control failed');
		}
	}

	// fallow-ignore-next-line complexity
	async function sendKismetControl(action: 'start' | 'stop'): Promise<void> {
		kismetBusy = true;
		setKismetStatus(action === 'start' ? 'starting' : 'stopping');
		try {
			const res = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ action })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setKismetStatus('stopped');
				toast.error(data.message ?? `Kismet ${action} failed (${res.status})`);
				return;
			}
			handleKismetResult(await res.json(), action);
		} catch {
			setKismetStatus('stopped');
		} finally {
			kismetBusy = false;
		}
	}
</script>

<div class="panel-toolbar">
	<span
		class="status-chip"
		class:chip-running={kismetStore.current.status === 'running'}
		class:chip-transition={kismetStore.current.status === 'starting' ||
			kismetStore.current.status === 'stopping'}
		>{kismetStore.current.status.toUpperCase()}</span
	>
	<span class="device-count">{deviceCount}</span>
	{#if renderedCount !== undefined && renderedCount < deviceCount}
		<span class="cap-badge">showing {renderedCount}</span>
	{/if}

	{#if isolatedMAC}
		<button class="back-btn" onclick={onClearIsolation} title="Back to all devices">
			<ChevronLeft size={14} />
			All
		</button>
	{/if}

	<div class="toolbar-separator"></div>

	<Search
		placeholder="Search MAC, SSID, manufacturer..."
		ariaLabel="Search devices"
		value={searchQuery}
		onInput={(value: string) => onSearchChange(value)}
		size="sm"
	/>

	<div class="toolbar-separator"></div>

	<div class="band-filters">
		{#each signalBands as band (band.key)}
			<button
				class="band-chip"
				class:hidden-band={!activeBands.has(band.key)}
				onclick={() => onToggleBand(band.key)}
				title={band.label}
			>
				<span class="band-dot" style="background: var({band.cssVar})"></span>
			</button>
		{/each}
		<button
			class="band-chip no-signal-chip"
			class:hidden-band={shouldHideNoSignal}
			onclick={onToggleNoSignal}
			title={shouldHideNoSignal
				? 'Show devices without signal'
				: 'Hide devices without signal'}
		>
			<span class="no-signal-label">--</span>
		</button>
		<button
			class="band-chip multi-client-chip"
			class:active-filter={shouldShowOnlyWithClients}
			onclick={onToggleOnlyWithClients}
			title={shouldShowOnlyWithClients
				? 'Show all devices'
				: 'Show only APs with connected clients'}
		>
			<UserMultiple size={12} />
			{#if apsWithClientsCount > 0}
				<span class="filter-badge">{apsWithClientsCount}</span>
			{/if}
		</button>
	</div>

	<div class="toolbar-separator"></div>

	<button class="scan-btn scan-clear" onclick={onClearAll} title="Clear search + all filters">
		Clear
	</button>
	{#if kismetStore.current.status === 'running' || kismetStore.current.status === 'stopping'}
		<button
			class="scan-btn scan-stop"
			onclick={() => sendKismetControl('stop')}
			disabled={kismetBusy}
		>
			{kismetBusy ? 'Stopping…' : 'Stop'}
		</button>
	{:else}
		<button
			class="scan-btn scan-start"
			onclick={() => sendKismetControl('start')}
			disabled={kismetBusy}
		>
			{kismetBusy ? 'Starting…' : 'Start'}
		</button>
	{/if}
</div>

<style>
	.panel-toolbar {
		display: flex;
		align-items: center;
		gap: var(--cds-spacing-03);
		padding: var(--cds-spacing-03) var(--cds-spacing-04);
		border-bottom: 1px solid var(--cds-border-subtle);
		flex-shrink: 0;
	}

	.panel-title {
		font-family: var(--cds-code-01-font-family);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 1.5px;
		color: var(--cds-text-helper);
	}

	.device-count {
		font-family: var(--cds-code-01-font-family);
		font-size: 14px;
		color: var(--cds-link-primary);
		font-variant-numeric: tabular-nums;
	}

	.cap-badge {
		font-family: var(--cds-code-01-font-family);
		font-size: 0.5625rem;
		color: var(--cds-text-helper);
		letter-spacing: 0.5px;
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background: color-mix(in srgb, var(--cds-text-primary) 8%, transparent);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		color: var(--cds-link-primary);
		font-size: 0.625rem;
		font-weight: 600;
		padding: 2px 6px;
		cursor: pointer;
		letter-spacing: 0.025em;
	}

	.back-btn:hover {
		background: var(--cds-layer);
	}

	.toolbar-separator {
		width: 1px;
		height: 16px;
		background: var(--cds-border-subtle);
		flex-shrink: 0;
	}

	.band-filters {
		display: flex;
		gap: var(--cds-spacing-02);
		align-items: center;
		flex-shrink: 0;
	}

	.band-chip {
		width: 24px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.band-chip.hidden-band {
		opacity: 0.25;
	}

	.band-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.no-signal-chip {
		margin-left: 2px;
	}

	.no-signal-label {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--cds-text-helper);
		line-height: 1;
	}

	.multi-client-chip {
		position: relative;
		width: auto;
		padding: 0 4px;
		gap: 2px;
		color: var(--cds-text-helper);
	}

	.multi-client-chip.active-filter {
		opacity: 1;
		border-color: var(--cds-link-primary);
		color: var(--cds-link-primary);
		background: color-mix(in srgb, var(--cds-link-primary) 10%, transparent);
	}

	.filter-badge {
		font-family: var(--cds-code-01-font-family);
		font-size: 8px;
		color: var(--cds-link-primary);
		line-height: 1;
	}

	.status-chip {
		padding: 2px 8px;
		border-radius: 3px;
		font-family: var(--cds-code-01-font-family);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.8px;
		background: var(--cds-layer-hover);
		color: var(--cds-text-helper);
	}

	.status-chip.chip-running {
		background: var(--cds-support-success);
		color: var(--cds-background);
	}

	.status-chip.chip-transition {
		background: var(--cds-support-warning);
		color: var(--cds-background);
	}

	.scan-btn {
		padding: 4px 14px;
		font-family: var(--cds-code-01-font-family);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.8px;
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.scan-start {
		background: color-mix(in srgb, var(--cds-support-success) 20%, var(--cds-layer));
		color: var(--cds-support-success);
		border-color: color-mix(in srgb, var(--cds-support-success) 40%, var(--cds-border-subtle));
	}

	.scan-start:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cds-support-success) 30%, var(--cds-layer));
	}

	.scan-stop {
		background: color-mix(in srgb, var(--cds-support-error) 20%, var(--cds-layer));
		color: var(--cds-support-error);
		border-color: color-mix(in srgb, var(--cds-support-error) 40%, var(--cds-border-subtle));
	}

	.scan-stop:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cds-support-error) 30%, var(--cds-layer));
	}

	.scan-clear {
		background: var(--cds-layer);
		color: var(--cds-text-helper);
	}

	.scan-clear:hover {
		background: var(--cds-layer-hover);
		color: var(--cds-text-primary);
	}

	.scan-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
