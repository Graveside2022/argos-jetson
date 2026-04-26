<script lang="ts">
	import Sparkline from '$lib/components/mk2/Sparkline.svelte';

	// spec-024 PR4 T024 — single gauge tile reused by HostMetricsTab for the
	// CPU / MEMORY / NETWORK / CORE TEMP cards. Kept tiny so the parent stays
	// declarative — alarm threshold + color choice + value formatting are all
	// caller responsibilities.

	interface Props {
		label: string;
		value: string;
		sub: string;
		series: readonly number[];
		color: string;
		alarm?: boolean;
		ariaLabel?: string;
	}

	let { label, value, sub, series, color, alarm = false, ariaLabel }: Props = $props();
</script>

<div class="metric" class:alarm>
	<div class="metric-head">
		<span class="label">{label}</span>
		{#if alarm}<span class="alarm-tag">HIGH</span>{/if}
	</div>
	<div class="val mono">{value}</div>
	<div class="sub mono">{sub}</div>
	<div class="spark">
		<Sparkline data={series} height={32} {color} ariaLabel={ariaLabel ?? `${label} trend`} />
	</div>
</div>

<style>
	.metric {
		padding: 14px 14px 10px;
		background: var(--mk2-bg-2);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.metric-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.label {
		font: 500 var(--mk2-fs-1) / 1 var(--mk2-f-mono);
		color: var(--mk2-ink-4);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.alarm-tag {
		color: var(--mk2-red);
		font: 500 var(--mk2-fs-1) / 1 var(--mk2-f-mono);
		letter-spacing: 0.1em;
	}

	.val {
		font-size: 22px;
		color: var(--mk2-ink);
		letter-spacing: 0.01em;
	}

	.metric.alarm .val {
		color: var(--mk2-red);
	}

	.sub {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
	}

	.spark {
		margin-top: 4px;
	}
</style>
