<script lang="ts">
	// spec-024 PR2 T016 — Mk II KV (key/value) list primitive.
	// 2-column data row stack used by sensor inspectors / mission strip.
	// Keys are 10.5-px caps in `--mk2-ink-4`; values are mono in `--mk2-ink`
	// with tabular-nums so columns of percentages line up.

	type Row = readonly [string, string | number];

	interface Props {
		rows: readonly Row[];
	}

	let { rows }: Props = $props();
</script>

<div class="dlist">
	{#each rows as [k, v] (k)}
		<div class="row">
			<div class="k">{k}</div>
			<div class="v">{v}</div>
		</div>
	{/each}
</div>

<style>
	.dlist {
		font-family: var(--mk2-f-mono);
		font-size: var(--mk2-fs-3);
	}

	.row {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 12px;
		padding: 4px 0;
		border-bottom: 1px dashed var(--mk2-line);
	}

	.row:last-child {
		border-bottom: 0;
	}

	.k {
		color: var(--mk2-ink-4);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: var(--mk2-fs-2);
		padding-top: 1px;
	}

	.v {
		color: var(--mk2-ink);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
</style>
