# Data Table — Code (POST-IMPL AMENDMENT)

**Status:** Phase 2 merged
**Last updated:** 2026-04-29 (post Phase 2 merge of PR #65)
**Implementation file:** `src/lib/components/chassis/drawer-tabs/DrawerTable.svelte`
**Carbon component:** `<DataTable>` from `carbon-components-svelte` v0.107.0+

---

## Argos wrapper API

The Argos `DrawerTable` component wraps Carbon's `<DataTable size="compact">` to add the Lunaris `Column<Row>.kind` discriminant + drag-reorder + localStorage persistence + kind-aware sort. Public API for consumers (unchanged from bespoke):

```ts
export type ColumnKind = 'id' | 'text' | 'num' | 'time' | 'tag' | 'action';

export interface Column<Row> {
	id: string;
	label: string;
	accessor: (row: Row) => string | number | null;
	kind: ColumnKind;
}

interface Props<Row> {
	storageKey: string; // localStorage key for column-order + sort persistence
	columns: readonly Column<Row>[];
	rows: readonly Row[];
	rowKey: (row: Row) => string;
	cell?: Snippet<[Row, Column<Row>]>;
}
```

---

## Implementation actuals (deviates from initial Phase 2 plan)

The pre-impl spec proposed letting Carbon own per-header sort via `header.sort = comparator`. The shipped implementation took a different path:

### What we actually did

| Concern                                  | Plan                                    | Shipped                                                                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sort logic                               | Per-header `sort` fn passed to Carbon   | **External** — bespoke `compareValues` in wrapper, sorted rows passed to Carbon pre-sorted                                                                                                                                    |
| Sort UI (asc↑/desc↓)                     | Carbon's built-in three-state indicator | **External** — wrapper renders Unicode arrow in `cellHeader` snippet, `header.sort: false` disables Carbon's sort UI                                                                                                          |
| Sort keyboard a11y                       | Carbon's button+ARIA pattern            | **External** — wrapper attaches `onkeydown` Enter/Space handlers to the inner `<span role="button" tabindex="0">`                                                                                                             |
| Drag-reorder                             | HTML5 DnD (carry-over from bespoke)     | **PointerEvents** (per memory `project_spec024_wave1_spikes_done.md`, T039 spike — 6.5× P95 win)                                                                                                                              |
| Original-row retrieval in `cell` snippet | `row.__row: R` static field             | **Side `Map<string, R>` keyed by `rowKey(r)`** — keeps `CarbonAugmentedRow` type free of static union members so `DataTableKey<Row>` resolves to permissive `PropertyPath`, not over-narrow `keyof KeysWithoutIndexSignature` |

### Why the deviations

**External sort:**

- `Column<Row>.kind` is the source of truth for compare semantics. We control `numeric vs string vs null-rank` in the wrapper; Carbon's per-header `sort` would have to receive the `kind` indirectly via closure, harder to type.
- Lets us bypass Carbon's typing constraint where `header.key` must be a static `keyof Row`. With permissive `Record<string, unknown> & { id: string }` we can fan accessor data into row[col.id] at any column id.
- Keyboard a11y was preserved via explicit `onkeydown` on the inner span — confirmed live in PR review.

**Side Map for original-row lookup:**

- Carbon's cell snippet receives `row: Row` where `Row` is the augmented row type fed to `<DataTable rows>`. Setting a static `__row: R` field would constrain `DataTableKey<Row>` to `"id" | "__row" | <accessor keys>` per Carbon's conditional type in `data-table-utils.d.ts`.
- The Map approach preserves Carbon's lenient key inference (`KeysWithoutIndexSignature<{id, [k: string]}> = {id}` → permissive PropertyPath branch).

**PointerEvents reorder:**

- Pure performance + UX win. HTML5 DnD's drag image and `dragover` event coalescing produced visible jank under 60 fps target. PointerEvents with `setPointerCapture` removes the drag-image ghost and lets us own the entire gesture envelope.
- Threshold-gate (5px movement) lets the same `<span>` host both click-to-sort AND drag-to-reorder without a dedicated drag handle.

---

## Consumer pattern (unchanged from bespoke)

```svelte
<script lang="ts">
	import DrawerTable, { type Column } from './DrawerTable.svelte';

	interface Row {
		mac: string;
		ssid: string;
		rssi: number;
	}

	const rows: readonly Row[] = [
		{ mac: 'A4:2B:B0:18:3F:91', ssid: 'NATO-GUEST', rssi: -42 }
		/* ... */
	];

	const columns: readonly Column<Row>[] = [
		{ id: 'mac', label: 'MAC', accessor: (r) => r.mac, kind: 'id' },
		{ id: 'ssid', label: 'SSID', accessor: (r) => r.ssid, kind: 'text' },
		{ id: 'rssi', label: 'RSSI', accessor: (r) => r.rssi, kind: 'num' }
	];
</script>

<DrawerTable storageKey="argos.drawer.wifi.cols" {columns} {rows} rowKey={(r) => r.mac}>
	{#snippet cell(r, col)}
		{#if col.id === 'rssi'}
			<span style:color={r.rssi >= -50 ? 'var(--accent)' : 'var(--ink)'}>{r.rssi}</span>
		{:else}
			{col.accessor(r) ?? ''}
		{/if}
	{/snippet}
</DrawerTable>
```

---

## State + persistence semantics

- **Column order** persisted to `localStorage[storageKey]` as `{order, sortById, sortDir}` JSON.
- **Initial population**: `order = columns.map(c => c.id)` runs in `onMount` (per memory `feedback_svelte_lsp_mandatory.md` — empty-init in `$state` to avoid `state_referenced_locally` warning, populate after mount).
- **Reconciliation**: stale ids drop out, new column ids append. Implemented as `$derived.by` (read-only, no effect-update-depth issues).
- **localStorage corruption**: silently falls back to defaults; never throws.
- **Storage disabled** (private mode etc.): silent failure on `setItem`; UI stays functional with in-memory state.
- **Drag click-vs-drag distinction**: `isDragging` flag set when pointer movement exceeds 5px; `onSortClick` reads-and-resets. Fresh `onPointerDown` also resets. Without click after pointerup, `isDragging` stays true until next interaction (acceptable — it just means the next click is consumed as a reset).

---

## Carbon `<DataTable>` features Argos doesn't use yet

Reserved for future phases:

- `selectable` / `radio-selectable` — single + multi-row selection
- `expandable` — row expansion for detail-on-demand
- `batch-actions` — bulk actions on selected rows (would require rewiring our augmented-row pattern to expose `__row` for bulk handlers)
- `toolbar` — search / filter / settings bar above the table
- `pagination` — page navigation; Carbon uses a separate `<Pagination>` component
- `with-overflow-menu` — per-row action menu
- `with-ai-label` — AI-presence styling per Carbon AI guidelines
- `virtualize` — viewport-aware row rendering for large datasets (relevant if drawer tabs ever stream 1000+ live signals)

---

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-datatable--default>
- Carbon source: `docs/carbon-design-system/packages/react/src/components/DataTable/`
- Carbon types: `node_modules/carbon-components-svelte/src/DataTable/DataTable.svelte.d.ts`
- Argos current implementation: `src/lib/components/chassis/drawer-tabs/DrawerTable.svelte` (Phase 2 PR #65, merged 2026-04-29)
- Wave-1 spike T039 (PointerEvents win): memory `project_spec024_wave1_spikes_done.md`
