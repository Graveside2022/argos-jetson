<script lang="ts">
	import type { FlightCategory, WeatherReport } from '$lib/types/weather';

	import OpsRow from './OpsRow.svelte';

	// spec-024 PR1 T011 — popover body for WeatherButton.
	// Renders empty / loading / error states alongside the populated layout.
	// Click-outside / Escape close-handling stays in the parent (WeatherButton).

	interface Props {
		wx?: WeatherReport | null;
		loading?: boolean;
		error?: string | null;
	}

	let { wx = null, loading = false, error = null }: Props = $props();

	const CAT_STROKE: Record<FlightCategory, string> = {
		VFR: 'var(--mk2-green)',
		MVFR: 'var(--mk2-cyan)',
		IFR: 'var(--mk2-red)',
		LIFR: 'var(--mk2-red)'
	};

	const catColor = $derived(wx ? CAT_STROKE[wx.cat] : 'var(--mk2-ink-4)');
</script>

{#snippet wxCell(label: string, main: string, sub: string)}
	<div class="wx-cell">
		<div class="wx-cell-label mono">{label}</div>
		<div class="wx-cell-main mono">{main}</div>
		<div class="wx-cell-sub mono">{sub}</div>
	</div>
{/snippet}

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
				<div class="wx-cat-badge mono" style:color={catColor} style:border-color={catColor}>
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
				wx.ceiling != null ? `ceiling ${wx.ceiling.toLocaleString()} ft` : 'unlimited'
			)}
			{@render wxCell('TEMPERATURE', `${wx.temp}°C`, `dew ${wx.dew}°C · ${wx.humidity}% RH`)}
			{@render wxCell('PRESSURE', `${wx.pressure} hPa`, '')}
			{@render wxCell('DAYLIGHT', `sunset ${wx.sunset}`, wx.moon.toLowerCase())}
		</div>

		<div class="wx-section">
			<div class="wx-section-head">OPERATIONS — CAN WE FLY / TRANSMIT?</div>
			<div class="wx-fc-list">
				<OpsRow ok={wx.ops.manned.ok} label="MANNED AIRCRAFT" note={wx.ops.manned.note} />
				<OpsRow ok={wx.ops.uas.ok} label="DRONE / UAS" note={wx.ops.uas.note} />
				<OpsRow
					ok={wx.ops.balloon.ok}
					label="HIGH-ALT BALLOON"
					note={wx.ops.balloon.note}
				/>
				<OpsRow ok={wx.ops.radio.ok} label="RADIO / SIGINT" note={wx.ops.radio.note} />
			</div>
		</div>

		<div class="wx-foot mono">
			<span>OBS {wx.obs}</span>
			<span>NEXT UPDATE {wx.nextUpdateAt}</span>
			<span>SRC {wx.source}</span>
		</div>
	{/if}
</div>

<style>
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
</style>
