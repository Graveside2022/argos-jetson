<script lang="ts">
	import { CloudSun } from '@lucide/svelte';

	import type { FlightCategory, WeatherReport } from '$lib/types/weather';

	// spec-024 PR1 T011 — Mk II weather popover button.
	// METAR-style flight-conditions readout. Click to open a 720px popover with:
	//   • flight category badge (VFR/MVFR/IFR/LIFR)
	//   • 6-cell weather grid (wind / vis / clouds / temp / pressure / daylight)
	//   • OPERATIONS GO/NO-GO matrix (manned aircraft / UAS / balloon / radio-SIGINT)
	//   • RAW METAR string + provenance footer
	// Data fetch lives in T012 (/api/weather/metar). This component is pure UI
	// and consumes a WeatherReport prop. Empty/loading/error states all render.

	interface Props {
		wx?: WeatherReport | null;
		loading?: boolean;
		error?: string | null;
	}

	let { wx = null, loading = false, error = null }: Props = $props();

	let open = $state(false);
	let wrapEl: HTMLDivElement | undefined = $state();

	const CAT_STROKE: Record<FlightCategory, string> = {
		VFR: 'var(--mk2-green)',
		MVFR: 'var(--mk2-cyan)',
		IFR: 'var(--mk2-red)',
		LIFR: 'var(--mk2-red)'
	};

	const catColor = $derived(wx ? CAT_STROKE[wx.cat] : 'var(--mk2-ink-4)');
	const buttonLabel = $derived.by(() => {
		if (loading) return 'WX…';
		if (error) return 'WX ERR';
		if (!wx) return 'NO WX';
		return wx.cat;
	});
	const tempLabel = $derived(wx ? `${Math.round(wx.temp)}°C` : '—');
	const windLabel = $derived(wx ? `WIND ${wx.wind.spd}KT` : 'WIND —');

	function close(): void {
		open = false;
	}

	function isOutsideClick(e: MouseEvent): boolean {
		if (!wrapEl) return false;
		return e.target instanceof Node && !wrapEl.contains(e.target);
	}

	function onPointerDown(e: MouseEvent): void {
		if (isOutsideClick(e)) close();
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Escape') close();
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

{#snippet wxCell(label: string, main: string, sub: string)}
	<div class="wx-cell">
		<div class="wx-cell-label mono">{label}</div>
		<div class="wx-cell-main mono">{main}</div>
		<div class="wx-cell-sub mono">{sub}</div>
	</div>
{/snippet}

{#snippet wxFc(ok: boolean, label: string, note: string)}
	<div class="wx-fc-row">
		<div class="wx-fc-dot" class:ok class:no={!ok}></div>
		<div class="wx-fc-label mono">{label}</div>
		<div class="wx-fc-state mono" style:color={ok ? 'var(--mk2-green)' : 'var(--mk2-amber)'}>
			{ok ? 'GO' : 'NO-GO'}
		</div>
		<div class="wx-fc-note mono">{note}</div>
	</div>
{/snippet}

<div class="wx-wrap" bind:this={wrapEl}>
	<button
		type="button"
		class="wx-btn"
		class:open
		title="Weather & flight conditions"
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<CloudSun size={13} />
		<span class="mono cat" style:color={catColor}>{buttonLabel}</span>
		<span class="mono ink-3">{tempLabel}</span>
		<span class="mono ink-4">{windLabel}</span>
	</button>

	{#if open}
		<div class="wx-panel" role="dialog" aria-label="Weather details">
			{#if loading}
				<div class="wx-empty mono">FETCHING METAR…</div>
			{:else if error}
				<div class="wx-empty mono error">METAR FAILED · {error}</div>
			{:else if !wx}
				<div class="wx-empty mono">NO STATION RESOLVED — GPS UNAVAILABLE</div>
			{:else}
				<div class="wx-panel-head">
					<div class="head-meta">
						<div class="mono head-station">LOCAL WEATHER · {wx.stationName}</div>
						<div class="head-summary">{wx.conds}</div>
						<div class="mono head-raw">RAW · {wx.raw}</div>
					</div>
					<div class="wx-cat-badge-group">
						<div
							class="wx-cat-badge mono"
							style:color={catColor}
							style:border-color={catColor}
						>
							{wx.cat}
						</div>
					</div>
				</div>

				<div class="wx-grid">
					{@render wxCell(
						'WIND',
						`${wx.wind.spd} kt`,
						wx.wind.variable
							? `from ${wx.wind.dir}° · varies ${wx.wind.variable}`
							: `from ${wx.wind.dir}°`
					)}
					{@render wxCell('VISIBILITY', `${wx.vis} km`, wx.vis >= 10 ? 'clear air' : '')}
					{@render wxCell(
						'CLOUDS',
						wx.conds,
						wx.ceiling != null
							? `ceiling ${wx.ceiling.toLocaleString()} ft`
							: 'unlimited'
					)}
					{@render wxCell(
						'TEMPERATURE',
						`${wx.temp}°C`,
						`dew ${wx.dew}°C · ${wx.humidity}% RH`
					)}
					{@render wxCell('PRESSURE', `${wx.pressure} hPa`, '')}
					{@render wxCell('DAYLIGHT', `sunset ${wx.sunset}`, wx.moon.toLowerCase())}
				</div>

				<div class="wx-section">
					<div class="wx-section-head">OPERATIONS — CAN WE FLY / TRANSMIT?</div>
					<div class="wx-fc-list">
						{@render wxFc(wx.ops.manned.ok, 'MANNED AIRCRAFT', wx.ops.manned.note)}
						{@render wxFc(wx.ops.uas.ok, 'DRONE / UAS', wx.ops.uas.note)}
						{@render wxFc(wx.ops.balloon.ok, 'HIGH-ALT BALLOON', wx.ops.balloon.note)}
						{@render wxFc(wx.ops.radio.ok, 'RADIO / SIGINT', wx.ops.radio.note)}
					</div>
				</div>

				<div class="wx-foot mono">
					<span>OBS {wx.obs}</span>
					<span>NEXT UPDATE {wx.nextUpdateAt}</span>
					<span>SRC {wx.source}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.wx-wrap {
		position: relative;
		display: inline-flex;
	}

	.wx-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 26px;
		padding: 0 10px;
		background: transparent;
		border: 1px solid var(--mk2-line-2);
		color: var(--mk2-ink-2);
		font: 500 var(--mk2-fs-3) / 1 var(--mk2-f-mono);
		letter-spacing: 0.04em;
		cursor: pointer;
		transition:
			border-color var(--mk2-mo-2),
			background var(--mk2-mo-2),
			color var(--mk2-mo-2);
	}

	.wx-btn:hover,
	.wx-btn.open {
		border-color: var(--mk2-line-hi);
		color: var(--mk2-ink);
		background: var(--mk2-bg-2);
	}

	.cat {
		font-weight: 600;
		letter-spacing: 0.08em;
	}

	.wx-panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		width: 720px;
		max-width: calc(100vw - 32px);
		background: var(--mk2-panel);
		border: 1px solid var(--mk2-line-hi);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
		z-index: 9999;
		color: var(--mk2-ink);
		font-size: var(--mk2-fs-4);
	}

	.wx-empty {
		padding: 24px 16px;
		color: var(--mk2-ink-3);
		text-align: center;
		letter-spacing: 0.14em;
		font-size: var(--mk2-fs-3);
	}

	.wx-empty.error {
		color: var(--mk2-red);
	}

	.wx-panel-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 14px 16px;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		gap: 14px;
	}

	.head-meta {
		flex: 1;
		min-width: 0;
	}

	.head-station {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		letter-spacing: 0.14em;
	}

	.head-summary {
		font-size: var(--mk2-fs-5);
		color: var(--mk2-ink);
		margin-top: 4px;
		font-family: var(--mk2-f-sans);
	}

	.head-raw {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		margin-top: 6px;
		letter-spacing: 0.04em;
	}

	.wx-cat-badge {
		padding: 4px 10px;
		border: 1px solid;
		font-size: var(--mk2-fs-4);
		font-weight: 600;
		letter-spacing: 0.14em;
		flex-shrink: 0;
	}

	.wx-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: var(--mk2-line);
		border-bottom: 1px solid var(--mk2-line);
	}

	.wx-cell {
		padding: 12px 14px;
		background: var(--mk2-panel);
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.wx-cell-label {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		letter-spacing: 0.14em;
	}

	.wx-cell-main {
		font-size: var(--mk2-fs-6);
		color: var(--mk2-ink);
		letter-spacing: 0.01em;
	}

	.wx-cell-sub {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
	}

	.wx-section {
		padding: 12px 16px 14px;
	}

	.wx-section-head {
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		letter-spacing: 0.14em;
		color: var(--mk2-ink-4);
		margin-bottom: 8px;
	}

	.wx-fc-list {
		display: flex;
		flex-direction: column;
	}

	.wx-fc-row {
		display: grid;
		grid-template-columns: 12px 150px 56px 1fr;
		gap: 10px;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px dashed var(--mk2-line);
		font-size: var(--mk2-fs-3);
	}

	.wx-fc-row:last-child {
		border-bottom: 0;
	}

	.wx-fc-dot {
		width: 8px;
		height: 8px;
		background: var(--mk2-ink-4);
	}

	.wx-fc-dot.ok {
		background: var(--mk2-green);
		box-shadow: 0 0 6px color-mix(in oklch, var(--mk2-green) 70%, transparent);
	}

	.wx-fc-dot.no {
		background: var(--mk2-amber);
		box-shadow: 0 0 6px color-mix(in oklch, var(--mk2-amber) 70%, transparent);
	}

	.wx-fc-label {
		color: var(--mk2-ink);
		letter-spacing: 0.06em;
	}

	.wx-fc-state {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.14em;
	}

	.wx-fc-note {
		color: var(--mk2-ink-3);
		font-size: var(--mk2-fs-2);
	}

	.wx-foot {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 9px 16px;
		border-top: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		letter-spacing: 0.06em;
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.ink-3 {
		color: var(--mk2-ink-3);
	}
	.ink-4 {
		color: var(--mk2-ink-4);
	}
</style>
