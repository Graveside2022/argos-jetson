<script lang="ts">
	import Renew from 'carbon-icons-svelte/lib/Renew.svelte';

	import InlineLoading from '$lib/components/chassis/forms/InlineLoading.svelte';
	import type { SystemInfo } from '$lib/types/system';

	import { formatBytes, formatUptime } from './types';

	interface Props {
		systemInfo: SystemInfo | null;
	}

	let { systemInfo }: Props = $props();

	function meterColor(value: number, warn: number, crit: number): string {
		if (value > crit) return 'var(--cds-support-error)';
		if (value > warn) return 'var(--cds-support-warning)';
		return 'var(--cds-link-primary)';
	}

	let memFreeGB = $derived(
		systemInfo?.memory.free != null ? formatBytes(systemInfo.memory.free) : null
	);
</script>

{#if systemInfo}
	<!-- CPU -->
	<section class="metric-section">
		<h3 class="section-label">CPU</h3>
		<div class="metric-row">
			<span class="metric-primary">{systemInfo.cpu.usage.toFixed(0)}%</span>
			{#if systemInfo.temperature != null}
				<span class="metric-secondary">{systemInfo.temperature.toFixed(0)}°C</span>
			{/if}
		</div>
		<div class="meter-bar">
			<div
				class="meter-fill"
				style="width: {systemInfo.cpu.usage}%; background: {meterColor(
					systemInfo.cpu.usage,
					50,
					80
				)}"
			></div>
		</div>
	</section>

	<!-- Disk -->
	<section class="metric-section">
		<h3 class="section-label">DISK</h3>
		<div class="metric-row">
			<span class="metric-primary">{formatBytes(systemInfo.storage.used)}</span>
			<span class="metric-secondary">/ {formatBytes(systemInfo.storage.total)}</span>
		</div>
		<div class="meter-bar">
			<div
				class="meter-fill"
				style="width: {systemInfo.storage.percentage}%; background: {meterColor(
					systemInfo.storage.percentage,
					75,
					90
				)}"
			></div>
		</div>
	</section>

	<!-- Memory -->
	<section class="metric-section">
		<h3 class="section-label">MEMORY</h3>
		<div class="metric-row">
			<span class="metric-primary">{formatBytes(systemInfo.memory.used)}</span>
			{#if memFreeGB}
				<span class="metric-secondary">{memFreeGB} free</span>
			{/if}
		</div>
		<div class="meter-bar">
			<div
				class="meter-fill"
				style="width: {systemInfo.memory.percentage}%; background: {meterColor(
					systemInfo.memory.percentage,
					70,
					85
				)}"
			></div>
		</div>
	</section>

	<!-- Power -->
	<section class="metric-section">
		<h3 class="section-label">POWER</h3>
		{#if systemInfo.battery}
			<div class="metric-row">
				<span class="metric-primary">{systemInfo.battery.level}%</span>
				<span class="metric-secondary">
					{systemInfo.battery.charging
						? 'charging'
						: systemInfo.battery.level > 20
							? `${Math.floor((systemInfo.battery.level / 100) * 5)}h remaining`
							: 'low battery'}
				</span>
			</div>
			<div class="meter-bar">
				<div
					class="meter-fill"
					style="width: {systemInfo.battery.level}%; background: {meterColor(
						100 - systemInfo.battery.level,
						60,
						80
					)}"
				></div>
			</div>
		{:else}
			<div class="metric-row">
				<span class="metric-primary ac">AC</span>
				{#if systemInfo.temperature != null}
					<span class="metric-secondary">{systemInfo.temperature.toFixed(1)}°C</span>
				{/if}
			</div>
			<div class="meter-bar">
				<div
					class="meter-fill"
					style="width: 100%; background: var(--cds-link-primary)"
				></div>
			</div>
		{/if}
	</section>

	<!-- Network Status -->
	<section class="net-section">
		<div class="net-header">
			<h3 class="section-label">NETWORK STATUS</h3>
			<span class="net-status-dot"></span>
			<span class="net-status-text">connected</span>
		</div>
		<div class="net-row">
			<span class="net-key">Host</span>
			<span class="net-val">{systemInfo.ip}</span>
		</div>
		{#if systemInfo.tailscaleIp}
			<div class="net-row">
				<span class="net-key net-key-muted">VPN</span>
				<span class="net-val">{systemInfo.tailscaleIp}</span>
			</div>
		{/if}
		<div class="net-row">
			<span class="net-key net-key-muted">Host</span>
			<span class="net-val">{systemInfo.hostname}</span>
			<span class="net-uptime">{formatUptime(systemInfo.uptime)}</span>
		</div>
		<button class="speed-test-btn">
			<Renew size={12} />
			Speed Test
		</button>
	</section>
{:else}
	<section class="metric-section">
		<h3 class="section-label">SYSTEM</h3>
		<InlineLoading description="Loading..." />
	</section>
{/if}

<style>
	/* ── Metric sections (CPU / Disk / Memory / Power) ── */
	.metric-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--cds-border-subtle);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-label {
		font-family: var(--cds-code-01-font-family);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--cds-text-helper);
		margin: 0;
	}

	.metric-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.metric-primary {
		font-family: var(--cds-code-01-font-family);
		font-size: 24px;
		font-weight: 600;
		color: var(--cds-text-primary);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.metric-primary.ac {
		font-size: 18px;
	}

	.metric-secondary {
		font-family: var(--cds-code-01-font-family);
		font-size: 12px;
		color: var(--cds-text-helper);
		font-variant-numeric: tabular-nums;
	}

	.meter-bar {
		width: 100%;
		height: 3px;
		background: var(--cds-layer);
		border-radius: 2px;
		overflow: hidden;
	}

	.meter-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	/* ── Network Status section ── */
	.net-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--cds-border-subtle);
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.net-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.net-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--cds-support-success);
		margin-left: auto;
		flex-shrink: 0;
	}

	.net-status-text {
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		color: var(--cds-support-success);
	}

	.net-row {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.net-key {
		font-family: var(--cds-code-01-font-family);
		font-size: 11px;
		color: var(--cds-text-primary);
		flex-shrink: 0;
	}

	.net-key-muted {
		color: var(--cds-text-helper);
	}

	.net-val {
		font-family: var(--cds-code-01-font-family);
		font-size: 11px;
		color: var(--cds-text-primary);
		font-variant-numeric: tabular-nums;
	}

	.net-uptime {
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		color: var(--cds-text-helper);
		margin-left: auto;
	}

	.speed-test-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		margin-top: 4px;
		padding: 6px;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		color: var(--cds-text-helper);
		font-family: var(--cds-code-01-font-family);
		font-size: 11px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.speed-test-btn:hover {
		background: var(--cds-layer-hover);
		color: var(--cds-text-primary);
	}
</style>
