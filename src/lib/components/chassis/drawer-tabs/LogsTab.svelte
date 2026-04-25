<script lang="ts">
	// spec-024 PR3 T021 — Logs drawer tab (static stub).
	// Hardcoded mock rows matching prototype `drawer.jsx`. Real wiring to
	// live log SSE lands in PR5+. Renders into the chassis Drawer body.

	type Level = 'INFO' | 'WARN' | 'ERROR';

	interface Row {
		t: string;
		lvl: Level;
		src: string;
		m: string;
	}

	const rows: readonly Row[] = [
		{ t: '202455Z', lvl: 'INFO', src: 'kismet', m: 'wlan1 · 214 devices visible' },
		{ t: '202454Z', lvl: 'INFO', src: 'hackrf', m: 'sweep 24-1750 MHz · 80 Hz/bin' },
		{ t: '202453Z', lvl: 'WARN', src: 'gsm', m: 'ARFCN 62 drift +0.21 kHz · retune' },
		{ t: '202451Z', lvl: 'INFO', src: 'tak', m: 'CoT forwarded · 42 tracks' },
		{ t: '202450Z', lvl: 'INFO', src: 'gps', m: 'fix · 13 SV · PDOP 1.4' },
		{ t: '202449Z', lvl: 'ERROR', src: 'bettercap', m: 'arp.spoof module failed · iface busy' },
		{ t: '202448Z', lvl: 'INFO', src: 'agent', m: 'claude · recon-01 · tool call airodump-ng' },
		{ t: '202447Z', lvl: 'INFO', src: 'kismet', m: 'new AP · E8:48:B8:2E:07:AA · kaserne-mesh' },
		{ t: '202446Z', lvl: 'WARN', src: 'thermal', m: 'jetson temp 54°C · fan ramp 62%' }
	];

	const lvlColor: Record<Level, string> = {
		INFO: 'var(--mk2-ink-3)',
		WARN: 'var(--mk2-amber)',
		ERROR: 'var(--mk2-red)'
	};
</script>

<div class="drw-scroll">
	{#each rows as r, i (`${r.t}-${i}`)}
		<div class="row">
			<span class="t">{r.t}</span>
			<span class="lvl" style:color={lvlColor[r.lvl]}>{r.lvl}</span>
			<span class="src">{r.src}</span>
			<span class="msg">{r.m}</span>
		</div>
	{/each}
</div>

<style>
	.drw-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
		font: 500 var(--mk2-fs-3) / 1.4 var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.row {
		display: grid;
		grid-template-columns: 80px 60px 90px 1fr;
		gap: 12px;
		padding: 4px 14px;
		border-bottom: 1px dashed var(--mk2-line);
	}

	.t {
		color: var(--mk2-ink-4);
	}

	.lvl {
		font-weight: 600;
		letter-spacing: 0.06em;
	}

	.src {
		color: var(--mk2-ink-3);
	}

	.msg {
		color: var(--mk2-ink);
	}
</style>
