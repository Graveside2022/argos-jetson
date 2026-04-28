# Data Table — Code

**Status:** Phase 1 in progress
**Last updated:** 2026-04-28
**Implementation file:** `src/lib/components/chassis/drawer-tabs/DrawerTable.svelte`
**Carbon component:** `<DataTable>` from `carbon-components-svelte` v0.107.0+

---

## Argos wrapper API

The Argos `DrawerTable` component wraps Carbon's `<DataTable>` to add the Lunaris `Column<Row>.kind` discriminant + drag-reorder + localStorage persistence. Public API for consumers:

```ts
export type ColumnKind = 'id' | 'text' | 'num' | 'time' | 'tag' | 'action';

export interface Column<Row> {
	id: string;
	label: string;
	accessor: (row: Row) => string | number | null;
	kind: ColumnKind;
}

interface Props<Row> {
	storageKey: string; // localStorage key for column-order + sort persistence (e.g. 'argos.drawer.logs.cols')
	columns: readonly Column<Row>[];
	rows: readonly Row[];
	rowKey: (row: Row) => string;
	cell?: Snippet<[Row, Column<Row>]>; // optional cell renderer for custom presentation
}
```

The `Column<Row>.kind` discriminant maps to Carbon's column config at render time:

| `kind`     | Carbon `<DataTable>` column option               | Lunaris styling additions                        |
| ---------- | ------------------------------------------------ | ------------------------------------------------ |
| `'id'`     | `align: 'start'`, `sort: true`                   | mono font, nowrap, identifier-width hint (~22ch) |
| `'text'`   | `align: 'start'`, `sort: true`                   | freeform wrap, flex-grow                         |
| `'num'`    | `align: 'end'`, `sort: true`, sortType numeric   | `font-variant-numeric: tabular-nums`             |
| `'time'`   | `align: 'start'`, `sort: true`, sortType numeric | tabular-nums, nowrap                             |
| `'tag'`    | `align: 'start'`, `sort: false`                  | nowrap, narrow column                            |
| `'action'` | `align: 'end'`, `sort: false`, no header label   | fixed 32px width, icon-only cells                |

---

## Consumer pattern

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

- **Column order** persisted to `localStorage[storageKey]` as `{order, sortById, sortDir}`.
- **Initial population**: `order = columns.map(c => c.id)` runs in `onMount` (per memory `feedback_svelte_lsp_mandatory.md` post-revert state — empty-init in `$state` to avoid `state_referenced_locally` warning, then populate after mount).
- **Reconciliation**: stale ids drop out, new column ids append. Implemented as `$derived.by` (read-only, no effect-update-depth issues).
- **localStorage corruption**: silently falls back to defaults; never throws.
- **Storage disabled** (private mode etc.): silent failure on `setItem`; UI stays functional with in-memory state.

---

## Carbon `<DataTable>` features Argos doesn't use yet

Reserved for future phases or screen-specific patterns:

- `selectable` / `radio-selectable` — single + multi-row selection
- `expandable` — row expansion for detail-on-demand
- `batch-actions` — bulk actions on selected rows
- `toolbar` — search / filter / settings bar above the table
- `pagination` — page navigation; Carbon uses a separate `<Pagination>` component
- `with-overflow-menu` — per-row action menu
- `with-ai-label` — AI-presence styling per Carbon AI guidelines

These become available "free" when consumer screens want them — the `<DataTable>` API is upstream Carbon. Lunaris just supplies the theme tokens.

---

## Migration path from bespoke (Phase 1 step-by-step)

1. **Build `DrawerTableCarbon.svelte`** as a parallel new component wrapping Carbon `<DataTable>`. Same public API as bespoke `DrawerTable.svelte` (`Column<Row>` + storageKey + rows + rowKey + cell snippet).
2. **Migrate canary** — `LogsTab.svelte` switches its import from `./DrawerTable` to `./DrawerTableCarbon`. Other 4 tabs still on bespoke. Visual + a11y verify.
3. **Migrate remaining 4 tabs** — Captures, Wifi, Bluetooth, Uas.
4. **Atomic swap** — delete bespoke `DrawerTable.svelte`, rename `DrawerTableCarbon.svelte` → `DrawerTable.svelte`. Import paths stable.

---

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-datatable--default>
- Carbon source: `docs/carbon-design-system/packages/react/src/components/DataTable/`
- Argos current bespoke: `src/lib/components/chassis/drawer-tabs/DrawerTable.svelte` (post-revert state at `64fbb2af`)
