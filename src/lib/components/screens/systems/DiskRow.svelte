<script lang="ts">
	const BYTES_PER_GB = 1024 * 1024 * 1024;
	const HOT_PCT = 75;

	interface Props {
		name: string;
		mount?: string;
		fs?: string;
		usedBytes: number;
		totalBytes: number;
	}

	let { name, mount, fs, usedBytes, totalBytes }: Props = $props();

	// Clamp [0, 100] guards against usedBytes > totalBytes counter-skew.
	const pct = $derived(
		totalBytes > 0 ? Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100)) : 0
	);
	const hot = $derived(pct > HOT_PCT);

	const metaText = $derived([mount, fs].filter(Boolean).join(' · '));

	function fmtGb(bytes: number): string {
		return (bytes / BYTES_PER_GB).toFixed(1);
	}
</script>

<div class="disk-row">
	<div class="disk-label">
		<span class="mono name">{name}</span>
		{#if metaText}<span class="mono meta">{metaText}</span>{/if}
	</div>
	<div class="disk-bar"><div class="disk-fill" class:hot style:width={`${pct}%`}></div></div>
	<div class="disk-vals mono">
		<span class:hot>{fmtGb(usedBytes)} GB</span>
		<span class="meta"> / {fmtGb(totalBytes)} GB</span>
		<span class="meta pct">{pct.toFixed(1)}%</span>
	</div>
</div>

<style>
	.disk-row {
		display: grid;
		grid-template-columns: 220px 1fr 200px;
		gap: 12px;
		align-items: center;
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.disk-label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.disk-label .name {
		color: var(--mk2-ink);
	}

	.disk-label .meta {
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-2);
	}

	.disk-bar {
		height: 6px;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
		position: relative;
		overflow: hidden;
	}

	.disk-fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--mk2-accent);
	}

	.disk-fill.hot {
		background: var(--mk2-red);
	}

	.disk-vals {
		font-size: var(--mk2-fs-3);
		text-align: right;
		color: var(--mk2-ink-2);
	}

	.disk-vals .hot {
		color: var(--mk2-red);
	}

	.disk-vals .meta {
		color: var(--mk2-ink-4);
	}

	.disk-vals .pct {
		margin-left: 8px;
	}
</style>
