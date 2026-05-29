<script lang="ts">
	import { formatUptime } from './types';

	interface Props {
		gpsdUptime: number | null;
		gpsdRunning: boolean;
	}

	let { gpsdUptime, gpsdRunning }: Props = $props();

	let uptimeDisplay = $derived(
		gpsdUptime != null && gpsdUptime > 0 ? formatUptime(gpsdUptime) : '—'
	);
</script>

<section class="svc-section">
	<h3 class="section-label">SERVICES</h3>
	<div class="svc-row">
		<span class="svc-dot" class:active={gpsdRunning}></span>
		<span class="svc-name">gpsd</span>
		<span class="svc-uptime">{uptimeDisplay}</span>
	</div>
</section>

<style>
	.svc-section {
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

	.svc-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.svc-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--cds-text-helper);
	}

	.svc-dot.active {
		background: var(--cds-support-success);
	}

	.svc-name {
		font-family: var(--cds-code-01-font-family);
		font-size: 11px;
		color: var(--cds-text-primary);
		flex: 1;
	}

	.svc-uptime {
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		color: var(--cds-text-helper);
		font-variant-numeric: tabular-nums;
	}
</style>
