# IBM Carbon Compliance Report — Argos UI (144 Svelte Components)

> **Decision context:** User has chosen **FULL IBM Carbon adoption**, consciously reversing **ADR 0001/0002** (which named Lunaris the forward system). This report measures the current gap against that goal and lays out a phased path. A superseding ADR is required (see §7).

---

## 1. Executive Summary

**Overall Carbon compliance: ~34% (per-component mean), median 18%.** The mean is heavily inflated by 20 tiny thin-wrapper form components (`chassis/forms/*`) scoring 98%; the median (18%) is the honest picture of the production surface. Strip the form wrappers and the real-screen UI sits in the **single digits to low teens**.

**Headline magnitude:**

- **144 components**, of which **105 use ZERO Carbon components** (73%).
- **0 components reference `--cds-*` tokens today** — and they _can't_, because of the prerequisite below.
- **803 Lunaris token references** + **292 hardcoded colors/hex** + **40 orphaned `--mk2-*` references** across the codebase.
- **83 of 144 components score below 25%.**

### Hard prerequisite (blocks everything)

The root layout imports `carbon-components-svelte/css/g100.css`, which **bakes literal hex values** into component CSS and **does NOT expose the 456 `--cds-*` custom properties**. Only `carbon-components-svelte/css/all.css` exposes `--cds-*`. **Today, every `var(--cds-*)` resolves to nothing.**

> **P1 gate — must ship first:** switch `g100.css` → `all.css` and wrap the app in `<Theme theme="g100">` in `src/routes/+layout.svelte`. Until this lands, _no_ `--cds-*` remediation works at all — any "fix" that swaps a Lunaris var for `--cds-text-secondary` will render transparent/black. This is non-negotiable ordering.

---

## 2. Compliance by Area

| Area      | #Components | Avg compliance % | #Using Carbon comps | Total hardcoded colors | Total `--mk2-*` orphans | Total Lunaris tokens |
| --------- | ----------- | ---------------- | ------------------- | ---------------------- | ----------------------- | -------------------- |
| chassis   | 29          | **77%**          | 23                  | 7                      | **40**                  | 25                   |
| map       | 13          | 38%              | 1                   | 53                     | 0                       | 40                   |
| routes    | 11          | 35%              | 2                   | 19                     | 0                       | 68                   |
| gsm-evil  | 11          | 30%              | 2                   | 4                      | 0                       | 65                   |
| dashboard | 66          | **18%**          | 10                  | **206**                | 0                       | **523**              |
| ui        | 14          | **15%**          | 1                   | 3                      | 0                       | 82                   |
| **TOTAL** | **144**     | **34%**          | **39**              | **292**                | **40**                  | **803**              |

**Reading it:**

- **chassis (77%)** is the bright spot — the Carbon form wrappers live here. But it also owns **all 40 `--mk2-*` orphans** (the drawer-tabs).
- **dashboard (66 comps, 18%)** is the bulk of the work: 206 hardcoded colors and 523 Lunaris references — the migration center of mass.
- **ui (15%)** is the shadcn-svelte primitive layer (`button`, `badge`, `input`, `table/*`) — low-count, but **high-leverage** because every gsm-evil/wireshark consumer inherits from it.
- **map (38%)** is partly out of scope: WebGL MapLibre paint props (`SatelliteLayer` 100%, `RfPathLayer` 90%) can't take CSS `--cds-*` and should be left alone or moved to a shared map-theme module.

---

## 3. Worst Offenders (lowest compliance, with the one fix)

| #   | Component                                       | %   | The one fix                                                                   |
| --- | ----------------------------------------------- | --- | ----------------------------------------------------------------------------- |
| 1   | `views/UASScanView.svelte`                      | 4%  | Strip **34 hex literals** → `--cds-*`; hand-rolled `<button>` → Carbon Button |
| 2   | `panels/OnnetToolsPanel.svelte`                 | 5%  | `<button>` → Carbon Button; `--font-mono`/`--text-xs` → `--cds-*` type tokens |
| 3   | `rf-propagation/CloudRFColormapSelector.svelte` | 5%  | Swatch `<button>` grid → Carbon Select/Dropdown                               |
| 4   | `rf-propagation/OverlayControls.svelte`         | 5%  | `<button>` → Carbon Button; Fira Code → `--cds-code-01-font-family`           |
| 5   | `shared/ToolCategoryCard.svelte`                | 5%  | `<button class=category-card>` → Carbon ClickableTile                         |
| 6   | `status/LatencyDropdown.svelte`                 | 5%  | Rebuild as Carbon Dropdown/Popover + Button (9× `--font-mono`)                |
| 7   | `status/MeshDropdown.svelte`                    | 5%  | Rebuild as Carbon Dropdown/Popover + Button                                   |
| 8   | `status/WeatherDropdown.svelte`                 | 5%  | Rebuild as Carbon Dropdown/Popover + Button (22 Lunaris tokens)               |
| 9   | `TerminalErrorOverlay.svelte`                   | 5%  | Render via Carbon InlineNotification (kind=error)                             |
| 10  | `views/NovaSDRView.svelte`                      | 5%  | `var(--background)` → `var(--cds-background)`; migrate ToolViewWrapper        |
| 11  | `views/OpenWebRXView.svelte`                    | 5%  | `var(--background)` → `var(--cds-background)`                                 |
| 12  | `views/SightlineView.svelte`                    | 5%  | `var(--background)` → `var(--cds-background)`                                 |
| 13  | `views/SpiderfootView.svelte`                   | 5%  | `var(--background)` → `var(--cds-background)`                                 |
| 14  | `views/ToolUnavailableView.svelte`              | 5%  | Rebuild empty state on Carbon Tile                                            |
| 15  | `views/WebTAKView.svelte`                       | 5%  | 5× `.action-btn`/`.retry-btn` → Carbon Button                                 |
| 16  | `ui/badge/badge.svelte`                         | 5%  | Replace shadcn primitive with Carbon **Tag** (cascades to all consumers)      |
| 17  | `ui/button/button.svelte`                       | 5%  | Replace shadcn primitive with Carbon **Button** (cascades everywhere)         |
| 18  | `ui/input/input.svelte`                         | 5%  | Replace shadcn `<input>` with Carbon TextInput/FileUploader                   |

**Pattern:** the worst offenders split into (a) "single `var(--background)` swap" iframe views — cheap wins that follow once P1 lands, and (b) the shadcn `ui/*` primitives — **highest leverage**, since `badge`/`button`/`input`/`table` reskinning automatically lifts every gsm-evil and WigleToTAK/Wireshark consumer.

---

## 4. Violation Patterns (recurring, with rough counts)

| Pattern                                                                                                                    | Magnitude                                                                                                     | Where it concentrates                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Lunaris `:root` token references** (`--card`, `--border`, `--foreground`, `--primary`, `--muted-foreground`, `--text-*`) | **~803 references** across **~95 components**                                                                 | dashboard (523), ui (82), routes (68), gsm-evil (65)                                                                   |
| **Hardcoded hex / rgba colors**                                                                                            | **~292**, incl. UASScanView (34), BluetoothPanel (14), TakStatusSection (12), CapturesPanel (12)              | dashboard (206), map (53, mostly WebGL — partly OK)                                                                    |
| **Hand-rolled `<button>`** where Carbon Button exists                                                                      | **~70+ buttons** across ~35 components                                                                        | everywhere; IconRail alone = 10                                                                                        |
| **Hand-rolled `<table>`/`<tr>` / shadcn Table** where Carbon DataTable exists                                              | **~10 tables**                                                                                                | DeviceTable, BluetoothPanel, IntelCategoryView, ScanResultsTable, TowerTable, UASPanel + shadcn `ui/table/*` (6 files) |
| **Non-IBM-Plex fonts** (`'Fira Code'`, `Geist`, `monospace`, `SF Mono`/`Menlo`)                                            | **~60+ font-family declarations**                                                                             | Fira Code is the dominant offender; should be `--cds-code-01-font-family` (IBM Plex Mono)                              |
| **Hardcoded px / Lunaris font-size** instead of Carbon type tokens                                                         | **~50+ declarations** (9–24px literals, `--text-sm/xs`)                                                       | overview cards (9–11px), dropdowns, all RF panels                                                                      |
| **Orphaned `--mk2-*` references**                                                                                          | **40**, all in `chassis/drawer-tabs/*` (DrawerTable 13, TerminalTab 12, WifiTab 8, LogsTab 6, BluetoothTab 1) | **These resolve to nothing today** — see §6 immediate bug                                                              |
| **shadcn-svelte primitives** used in place of Carbon                                                                       | `ui/button`, `ui/badge`, `ui/input`, `ui/table/*` + ~12 consumers (TAK forms, gsm-evil, Wireshark, SDRpp)     | the `ui/` layer                                                                                                        |
| **Tailwind raw palette literals** (`green-500`, `red-400`, `amber-400`, `bg-black`)                                        | ~6 components (TAK auth, gsm-evil tables/consoles)                                                            | should be `--cds-support-{success,error,warning}`                                                                      |

---

## 5. Carbon Component Opportunities (ranked by frequency)

| Rank | Hand-rolled / shadcn pattern          | Maps to (carbon-components-svelte)                     | Approx. occurrences                           |
| ---- | ------------------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| 1    | Bare `<button>` / shadcn Button       | **Button** (kind/size, icon-only via IconButton)       | ~70+ across ~35 files                         |
| 2    | Lunaris token / hex on surface        | (token bridge, not a component)                        | ~95 files                                     |
| 3    | `<table>` / `<tr>` / shadcn Table     | **DataTable** (sortable, expandable rows)              | ~10 + 6 shadcn primitives                     |
| 4    | status dots / pills / shadcn Badge    | **Tag** (support colors)                               | ~12                                           |
| 5    | hand-rolled error/empty/status blocks | **InlineNotification** (+ EmptyState pattern via Tile) | ~10                                           |
| 6    | custom dropdown/popup menus           | **Dropdown / OverflowMenu / Popover**                  | ~8 (status dropdowns, terminal, shell-picker) |
| 7    | shadcn `<input>` / raw `<input>`      | **TextInput / PasswordInput / TextArea**               | ~8 (TAK forms, webtak, preset)                |
| 8    | hand-rolled tab bars                  | **Tabs / Tab**                                         | ~3 (EditorTabBar, BottomPanelTabs)            |
| 9    | card / tool-card / status panels      | **Tile / ClickableTile**                               | ~10 (overview cards, tool cards, RF status)   |
| 10   | raw `<input type=file>`               | **FileUploader**                                       | ~5 (TAK import/truststore/datapackage)        |
| 11   | toggles / switches                    | **Toggle**                                             | ~3 (GpConfigView, MapLayersView)              |
| 12   | nav segments                          | **ContentSwitcher / SideNav**                          | ~2 (MapSettingsPanel, ToolsNavigationView)    |

**Highest leverage:** Button (#1) and the shadcn `ui/*` primitives (#3, #4, #7) — fixing the shared primitives cascades to every consumer.

---

## 6. Phased Migration Plan

### ⚠️ Immediate styling bug (do in P1/P2)

The **40 orphaned `--mk2-*` references** in `chassis/drawer-tabs/*` (DrawerTable, BluetoothTab, LogsTab, TerminalTab, WifiTab) reference a Mk II token set that **no longer exists** — they currently resolve to nothing and the drawer tables are rendering with broken/default colors **right now**. This is a live visual bug, not just a compliance gap. Fix in P1/P2 by mapping `--mk2-*` → `--cds-layer/text/border/support-*`.

### P1 — Expose tokens (the gate) · **Effort: XS (~1 file, hours)**

- Switch `g100.css` → `all.css`; add `<Theme theme="g100">` wrapper in `+layout.svelte`.
- **Without this, no `--cds-*` works.** Verify `getComputedStyle(document.documentElement).getPropertyValue('--cds-text-secondary')` returns a value.
- Fold in the `--mk2-*` orphan fix here (drawer-tabs).
- **Verify:** one `var(--cds-background)` swap (e.g. SightlineView) now renders correctly.

### P2 — Token bridge · **Effort: S (~1 file → 86 inherit)**

- Redefine the Lunaris `:root` hex tokens (the 86-file system) **in terms of** `--cds-*`: e.g. `--card: var(--cds-layer-01); --foreground: var(--cds-text-primary); --border: var(--cds-border-subtle-01);`.
- This single file flips the **~803 Lunaris references** to Carbon-correct values **without touching 95 components**. Biggest compliance jump per unit effort.
- **Verify:** spot-check 5 panels visually; hardcoded hex (292) still remain but Lunaris-var components now read from Carbon.

### P3 — 13 MIL-STD palettes as Carbon overrides · **Effort: M**

- Re-express the 13 `[data-palette]` themes as Carbon **brand/interactive/link/focus** token overrides (`--cds-interactive`, `--cds-link-primary`, `--cds-focus`, `--cds-button-primary`) rather than custom hex blocks, so palette switching rides the Carbon token layer established in P2.
- **Verify:** switch palettes; Carbon components recolor consistently.

### P4 — Component swap · **Effort: L (the long tail)**

- Replace hand-rolled patterns per §5 frequency order: Button → DataTable → Tag → InlineNotification → inputs → Tabs → Tile.
- **Start with shadcn `ui/*` primitives** (button/badge/input/table) for cascade leverage.
- ⚠️ **Blocker (per ADR 0002):** carbon-components-svelte **0.107-era components are dispatch/`createEventDispatcher`-based**, which collides with the Svelte 5 callback-prop migration. Confirm the pinned version and event API before bulk swaps; some components need callback-prop shims. **`carbon-preprocess-svelte@0.11.30`** (already in devDeps) provides optimize/`<Theme>` preprocessing and should be enabled in the Svelte/Vite config to support the `<Theme>` API and tree-shaking — wire it as part of P1/P4.
- Strip the 292 hardcoded hex and Tailwind raw-palette literals here.
- **Verify:** per-component re-audit; `tsc`/lint gate after each swap.

### P5 — Typeface · **Effort: S (decision + 1 config)**

- **Decision point:** Carbon's tokens assume **IBM Plex Sans/Mono**, but Argos ships **Geist/Geist Mono**. Two options:
    - **(a) Go full IBM Plex** — adopt `@ibm/plex`, let `--cds-*` font tokens flow. Maximal Carbon fidelity.
    - **(b) Keep Geist** — override `--cds-*-font-family` tokens to point at Geist/Geist Mono. Preserves current brand, still "Carbon-structured."
- Either way, replace the ~60+ non-Plex `font-family` literals (esp. `'Fira Code'`) and px font-sizes with the Carbon **type token groups** (`code-01`, `body-compact-01`, `label-01`, `caption-01`).

**Ordering is strict: P1 → P2 → P3 → (P4 ∥ P5).** P1 is a hard gate; P2 is the single highest-ROI step; P4 is the bulk of the labor.

---

## 7. Superseding ADR Required

This migration **consciously reverses ADR 0001 (stay Lunaris/custom)** and **ADR 0002 (finish runes migration on Lunaris as the forward system)**. A new ADR should be authored to record:

- The decision: **full IBM Carbon adoption** as the forward design system, superseding 0001/0002.
- The trigger/rationale for the reversal.
- The accepted blockers: the dispatch-based 0.107 Carbon component API vs Svelte 5 callback-props (carry-over from ADR 0002), and the IBM-Plex-vs-Geist typeface decision (P5).
- The token-bridge strategy (P2) as the chosen low-risk path so the 86 Lunaris-consuming files are not hand-edited.

Without this ADR, the migration contradicts two accepted records and will read as undocumented drift.
