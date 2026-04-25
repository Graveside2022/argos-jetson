<script lang="ts">
	// spec-024 PR2 T016 — Mk II Metric primitive.
	// Number + unit pair for sensor tiles / overview gauges. `big` jumps the
	// value to the 28-px hero size; `acc` paints it in the active accent.
	// Units stay in a 10-px tracking-wide caps caption row.

	interface Props {
		n: string | number;
		u?: string;
		big?: boolean;
		acc?: boolean;
	}

	let { n, u, big = false, acc = false }: Props = $props();
</script>

<div class="metric">
	<div class="n" class:big class:acc>{n}</div>
	{#if u}<div class="u">{u}</div>{/if}
</div>

<style>
	.metric {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.n {
		font: 500 22px/1 var(--mk2-f-mono);
		color: var(--mk2-ink);
		font-variant-numeric: tabular-nums;
	}

	.n.big {
		font-size: 28px;
	}
	.n.acc {
		color: var(--mk2-accent);
	}

	.u {
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		color: var(--mk2-ink-4);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
</style>
