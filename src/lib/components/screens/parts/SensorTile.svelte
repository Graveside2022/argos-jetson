<script lang="ts">
	// spec-024 PR5c T031 — generic OVERVIEW sensor tile.
	//
	// Props-driven shell consumed 4× by the SENSORS region for sweep /
	// devices / GPS / system. Every numeric input is a real, live value
	// supplied by the caller — no mock fallbacks. When `value` is null
	// the tile renders the empty-state token "—" (per design system
	// component-state rule). Sparkline degrades to a flat midline when
	// `series.length < 2` (already handled by the primitive).

	import Metric from '$lib/components/mk2/Metric.svelte';
	import Sparkline from '$lib/components/mk2/Sparkline.svelte';

	interface Props {
		label: string;
		value: number | string | null;
		unit?: string;
		sub?: string;
		series?: readonly number[];
		stale?: boolean;
	}

	let { label, value, unit, sub, series = [], stale = false }: Props = $props();

	const display = $derived(value === null ? '—' : value);
</script>

<div class="sensor-tile" class:stale aria-label={label}>
	<div class="head">
		<span class="label">{label}</span>
		{#if sub}<span class="sub">{sub}</span>{/if}
	</div>
	<Metric n={display} u={unit} acc={!stale && value !== null} />
	<div class="spark">
		<Sparkline data={series} ariaLabel="{label} trend" />
	</div>
</div>

<style>
	.sensor-tile {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		background: var(--card);
		min-width: 0;
	}

	.sensor-tile.stale {
		opacity: 0.55;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}

	.label {
		font: 500 9px/1.2 var(--mk2-f-mono, 'Fira Code', monospace);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted-foreground);
	}

	.sub {
		font: 400 10px/1 var(--mk2-f-mono, 'Fira Code', monospace);
		color: var(--mk2-ink-4, var(--muted-foreground));
		font-variant-numeric: tabular-nums;
	}

	.spark {
		margin-top: 2px;
	}
</style>
