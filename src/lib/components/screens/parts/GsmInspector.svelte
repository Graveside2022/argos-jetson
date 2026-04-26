<script lang="ts">
	// spec-024 PR10b T052 — Mk II GSM IMSI inspector aside.
	//
	// Selection inspector: cell info strip (MCC/MNC/LAC/CI + tower
	// city/lat/lon when looked up by gsmStore) + 5 action buttons
	// (TRACK / TAG / EXPORT / SIM-LOOKUP / FLAG). Buttons are UI-only
	// — clicking records an AppEvent into PR5c's eventBuffer so the
	// operator audit trail captures intent. Per repo rule (no synthetic
	// data) the buttons never fake a backend response.

	import { recordEvent } from '$lib/state/events.svelte';
	import { gsmStore } from '$lib/state/gsm.svelte';
	import type { CellLocation, ImsiRow } from '$lib/types/imsi-row';

	const ACTIONS: readonly { id: string; label: string }[] = [
		{ id: 'track', label: 'TRACK' },
		{ id: 'tag', label: 'TAG' },
		{ id: 'export', label: 'EXPORT' },
		{ id: 'sim-lookup', label: 'SIM LOOKUP' },
		{ id: 'flag', label: 'FLAG' }
	];

	function fmtNullable(s: string | null): string {
		return s ?? '—';
	}

	function fmtCoord(c: CellLocation | null, key: 'lat' | 'lon'): string {
		return c === null ? '—' : c[key].toFixed(4);
	}

	function fmtCity(c: CellLocation | null): string {
		return c?.city ?? '—';
	}

	function runAction(id: string): void {
		const sel = gsmStore.selected;
		if (!sel) return;
		recordEvent('info', 'gsm', {
			action: id,
			imsi: sel.imsi,
			mcc: sel.mcc,
			mnc: sel.mnc,
			lac: sel.lac,
			ci: sel.ci
		});
	}

	function rowsFor(sel: ImsiRow, tower: CellLocation | null): readonly [string, string][] {
		return [
			['IMSI', sel.imsi],
			['TMSI', fmtNullable(sel.tmsi)],
			['MCC', fmtNullable(sel.mcc)],
			['MNC', fmtNullable(sel.mnc)],
			['LAC', fmtNullable(sel.lac)],
			['CI', fmtNullable(sel.ci)],
			['CITY', fmtCity(tower)],
			['LAT', fmtCoord(tower, 'lat')],
			['LON', fmtCoord(tower, 'lon')]
		];
	}
</script>

<aside class="inspector-region" aria-labelledby="gsm-inspector-h">
	<header class="region-head">
		<span id="gsm-inspector-h" class="region-label">INSPECTOR</span>
	</header>
	{#if gsmStore.selected}
		{@const sel = gsmStore.selected}
		{@const tower = gsmStore.selectedTower}
		<div class="kv-list">
			{#each rowsFor(sel, tower) as [k, v] (k)}
				<div class="kv-row"><span class="k">{k}</span><span class="v">{v}</span></div>
			{/each}
		</div>
		<div class="actions">
			{#each ACTIONS as a (a.id)}
				<button type="button" class="action-btn" onclick={() => runAction(a.id)}>
					{a.label}
				</button>
			{/each}
		</div>
	{:else}
		<div class="inspector-empty">select an IMSI</div>
	{/if}
</aside>

<style>
	.inspector-region {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		background: var(--card);
		min-height: 0;
		font-family: 'Fira Code', monospace;
	}
	.region-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.region-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted-foreground);
	}
	.kv-list {
		display: flex;
		flex-direction: column;
		font-size: 11px;
	}
	.kv-row {
		display: grid;
		grid-template-columns: 70px 1fr;
		gap: 8px;
		padding: 4px 0;
		border-bottom: 1px dashed var(--border);
		font-variant-numeric: tabular-nums;
	}
	.kv-row .k {
		color: var(--mk2-ink-4, var(--muted-foreground));
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.kv-row .v {
		color: var(--mk2-ink, var(--foreground));
		text-align: right;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin-top: 12px;
	}
	.action-btn {
		padding: 6px 10px;
		background: transparent;
		border: 1px solid var(--mk2-line, var(--border));
		color: var(--mk2-ink, var(--foreground));
		font: 500 10px / 1 inherit;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.action-btn:hover {
		color: var(--mk2-accent, var(--primary));
		border-color: var(--mk2-accent, var(--primary));
	}
	.inspector-empty {
		color: var(--muted-foreground);
		opacity: 0.6;
		padding: 8px;
		text-align: center;
		font-size: 11px;
	}
</style>
