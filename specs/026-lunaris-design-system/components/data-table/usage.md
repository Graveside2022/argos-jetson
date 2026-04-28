# Data Table — Usage

**Status:** Phase 1 in progress
**Last updated:** 2026-04-28
**Carbon mirror:** `docs/carbon-website/src/pages/components/data-table/usage.mdx`
**Implementation:** `src/lib/components/chassis/drawer-tabs/DrawerTable.svelte` (post-Phase-1 will wrap Carbon `<DataTable>`)

---

## When to use

- Display tabular data with multiple homogeneous rows.
- Allow user navigation across columns via sort or drag-reorder.
- Surface RF/network telemetry where a row = one entity (signal, AP, BLE device, drone, log line, capture file).

## When not to use

- A list of unrelated items where columns aren't shared semantics → use `<List>` or `<StructuredList>` instead.
- A matrix where headers are X+Y axes (e.g., heatmap) → use a custom canvas/SVG component.
- Single-record key-value display → use `KV` (`docs/argos-v2-mockup/src/primitives.jsx`).

---

## Variants used in Argos

| Variant                            | Argos consumer                                      | Notes                                                                                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default + sortable**             | LogsTab, CapturesTab, WifiTab, BluetoothTab, UasTab | Click column header to cycle sort asc → desc → asc. localStorage-persisted per tab.                                                                                                                                 |
| **Drag-reorder columns**           | All 5 drawer tabs                                   | Argos extension over Carbon — drag column header to reorder. Order persisted to localStorage per tab. Carbon doesn't ship this; preserved as an Argos-specific column-header behavior wrapped around `<DataTable>`. |
| **With selection / batch actions** | _not yet used in Argos_                             | Carbon's `<DataTable>` supports it; reserved for future inventory screens.                                                                                                                                          |
| **With expansion**                 | _not yet used in Argos_                             | Reserved for future detail-on-demand patterns (e.g. expand a Wi-Fi AP row to see clients).                                                                                                                          |
| **Toolbar with search/filter**     | _not yet used_                                      | Reserved for future.                                                                                                                                                                                                |

---

## Argos-specific extensions

These are NOT in Carbon's `<DataTable>` API. Wrapped around the Carbon component:

- **`Column<Row>.kind` discriminant** — semantic column type (`'id' | 'text' | 'num' | 'time' | 'tag' | 'action'`). Drives both Carbon column config (`isSortable`, alignment) AND Argos-specific styling (id = mono font; tag = uppercase letter-spacing; etc.).
- **localStorage persistence per tab** — column order + sort state keyed as `argos.drawer.<tab>.cols`. Survives page reloads. Reset rule: corrupt JSON or disabled storage → silently fall back to defaults.
- **Drag-reorder columns** — preserved from bespoke `DrawerTable.svelte` (commit `64fbb2af`). HTML5 drag-and-drop on `<th>` elements with visual drop-target indicators.

---

## Anatomy

Per Carbon `usage.mdx` (last modified 2025-04-30):

1. **Title and description** — sentence-case capitalization.
2. **Toolbar** — global controls (search, filter, settings).
3. **Column header** — title + optional sort indicator. Sentence-case capitalization in Carbon; **Argos overrides to UPPERCASE + 0.08em letter-spacing per Lunaris convention** (`docs/argos-v2-mockup/styles.css` line 226).
4. **Table row** — selectable, expandable, modified for zebra-stripes (Argos uses hover-only, no zebra).
5. **Pagination bar** — bottom-aligned, optional. Not used in Argos drawer tabs.

---

## Authority citations

- Carbon `usage.mdx`: `docs/carbon-website/src/pages/components/data-table/usage.mdx` (last modified 2025-04-30)
- v2 mockup table JSX: `docs/argos-v2-mockup/src/drawer.jsx` lines 122-130, 139-147, 153-161, 173-179
- v2 mockup table CSS: `docs/argos-v2-mockup/styles.css` lines 565-594
