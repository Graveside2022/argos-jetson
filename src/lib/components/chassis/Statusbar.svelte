<script lang="ts">
	// spec-024 PR1 T010 — Mk II statusbar.
	// LINK / CPU / MEM / TEMP / NVMe / SESSION readouts + ⌘K / ? / / kbd hint chips.
	// Live wiring to /api/system/* lands in PR4 (T024); for now values are props
	// with defaults so the bar renders standalone.

	interface LinkStatus {
		state?: 'up' | 'down' | 'degraded';
		throughput?: string;
	}

	interface SystemStats {
		cpuPct?: number;
		memUsedGb?: number;
		memTotalGb?: number;
		tempC?: number;
		nvmeFreeGb?: number;
	}

	interface Props {
		link?: LinkStatus;
		system?: SystemStats;
		session?: string;
	}

	let { link = {}, system = {}, session = '—' }: Props = $props();

	const linkColor = $derived.by(() => {
		switch (link.state) {
			case 'up':
				return 'var(--mk2-green)';
			case 'degraded':
				return 'var(--mk2-amber)';
			case 'down':
				return 'var(--mk2-red)';
			default:
				return 'var(--mk2-ink-4)';
		}
	});

	const cpu = $derived(system.cpuPct == null ? '—' : `${Math.round(system.cpuPct)}%`);
	const mem = $derived(
		system.memUsedGb == null || system.memTotalGb == null
			? '—'
			: `${system.memUsedGb.toFixed(1)}/${system.memTotalGb} GB`
	);
	const temp = $derived(system.tempC == null ? '—' : `${Math.round(system.tempC)}°C`);
	const nvme = $derived(
		system.nvmeFreeGb == null ? '—' : `${Math.round(system.nvmeFreeGb)} GB FREE`
	);
</script>

<div class="cell link">
	<span class="dot" style:color={linkColor}>●</span>
	LINK · {link.throughput ?? '—'}
</div>
<div class="cell">CPU {cpu} · MEM {mem} · TEMP {temp}</div>
<div class="cell">NVMe {nvme}</div>
<div class="cell">SESSION · {session}</div>

<div class="spacer"></div>

<div class="cell hints">
	<span class="kbd">⌘K</span> COMMAND
	<span class="kbd">/</span> FILTER
	<span class="kbd">?</span> HELP
</div>

<style>
	.cell {
		padding: 0 10px;
		border-right: 1px solid var(--mk2-line);
		height: 100%;
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.spacer {
		flex: 1;
	}

	.hints {
		border-right: 0;
		border-left: 1px solid var(--mk2-line);
		gap: 8px;
	}

	.kbd {
		border: 1px solid var(--mk2-line-2);
		padding: 1px 4px;
		font: 500 var(--mk2-fs-1) / 1 var(--mk2-f-mono);
		color: var(--mk2-ink-3);
		background: var(--mk2-bg-2);
	}

	.dot {
		font-size: 9px;
		line-height: 1;
	}
</style>
