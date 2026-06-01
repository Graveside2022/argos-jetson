<!-- Carbon migration execution guide — generated 2026-05-29 from a parallel
     pre-staging audit of all 94 remaining components. -->

# Carbon Migration Execution Guide (ADR 0006)

> ## ⚠️ This guide is a HYPOTHESIS — verify before every edit
>
> The per-component plans below were produced by audit agents and CAN be stale or
> wrong (missed token, misclassified complexity, missed consumer). **Per component,
> BEFORE editing:**
>
> 1. **Re-read the actual file** (ground truth, not this plan).
> 2. **codegraph** — confirm consumers / blast-radius + that imports/usage match.
> 3. **semble / grep** — sweep for tokens/patterns the audit may have missed.
> 4. **Reconcile**: if plan ≠ code, trust the CODE.
>
> **AFTER editing, per component:** `svelte-autofixer` (Svelte-5 idioms) + `eslint --fix`
>
> - `svelte-check` + `npm run build` (hard gates) + chrome-devtools e2e (novel UI) →
>   PR → CI-green merge. Carbon component APIs verified via context7 + the package
>   `.d.ts`; structure via codegraph/semble.

End state: pure Svelte + IBM Carbon, zero shadcn `ui/*`, zero Lunaris `--var` tokens (all `--cds-*`). Migrate **one area per PR**, surgically, verified.

## 0. Verified facts (resolved the repeated "verify X" flags)

| Question plans kept flagging              | Answer (verified this run)                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carbon class prefix: `.bx--` or `.cds--`? | **`.bx--`**. Installed `carbon-components-svelte@0.107.0` (Carbon v10/v11 line). Every `:global(.bx--…)` selector in `Tabs.svelte`, `ToastRegion.svelte`, `TakAuthMethodPicker.svelte` **stays `.bx--`** — do NOT rename to `.cds--`.                                                                                                    |
| Are `--cds-*` vars actually on `:root`?   | **Yes, NOW.** `import 'carbon-components-svelte/css/all.css'` is in `src/routes/+layout.svelte` with `theme="g100"` on `<html>`. The 457 `--cds-*` props are live. The "sequence after P-token-bridge" caveat in `map-colors.ts`/`map-helpers.ts`/`map-markers.css`/`terminal-theme.ts` is **already satisfied** — those swaps are safe. |
| `lunaris-carbon-theme.scss`               | Stub overlay (0 `--cds-*` defs). Not a dependency for these PRs.                                                                                                                                                                                                                                                                         |

**Therefore:** drop Lunaris hex fallbacks inside `var(--x, #hex)` once swapped to `var(--cds-*)` — Carbon tokens are guaranteed defined.

## 1. Summary

**94 plans** (Svelte components, CSS files, TS modules).

**By complexity:** trivial 19 · moderate 33 · complex 30 · (13 are CSS/TS-only no-markup units folded into those counts).

**By area (file count):**

- chassis / chassis/forms: 6
- dashboard (chrome/shell/terminal/status): ~24
- dashboard/map (+ map/\*): 9
- dashboard/panels (+ devices, overview, rf-propagation, map-settings): ~30
- dashboard/tak: 7
- dashboard/views (+ webtak): 7
- gsm-evil: 5
- routes (+error, dashboard shell, gsm-evil, recon/cellular): 6

**e2e-needed: 47 files** (every interactive: buttons, forms, tables, toggles, sliders, dropdowns, popups, SSE/stream, map). Trivial/presentational/CSS-only → screenshot or skip.

**Shadcn `ui/*` still present (must be removed):** `gsm-evil/*` (Button/Badge/Table ×4 files), `MapProviderView` (ui/input), TAK auth/server/truststore forms (ui/input ×5), `ScanResultsTable`/`TowerTable` (ui/table+badge+button). Everything else is already off shadcn or never used it.

**Reference end-state:** `panels/devices/DeviceWhitelist.svelte` — already 100% Carbon (Button+TextInput+Close icon, all `--cds-*`). Use as the canonical pattern.

## 2. Mechanical recipe (applies to every PR)

1. **Token swap** — Lunaris `--var` → `--cds-*` per the map below. Drop the `var(--x, #hex)` Lunaris fallback.
2. **Hex** — only swap _chrome_ hex that are Lunaris fallbacks. **DOMAIN/data-viz hex stay literal** (see §4, charts phase).
3. **Icons** — hand-rolled inline `<svg>` and `@lucide/svelte` → `carbon-icons-svelte`. Carbon icons take `size={16|20|24}` (18 off-grid → 20). They inherit `currentColor`; drop width/height attrs.
4. **Native controls** — convert per plan, BUT honor every `@constitutional-exemption` (Article-IV-4.2/4.3 keep custom buttons/tables/loading-state). When in doubt: token-swap only, defer the component conversion.
5. **shadcn** — `ui/button`→Button (`variant→kind`, `size="sm"→"small"`, `onclick→on:click`); `ui/input`→TextInput/PasswordInput (`labelText`+`hideLabel`, drop Tailwind `h-7/flex-1/text-xs`); `ui/badge`→Tag; `ui/table`→Table primitives (NOT DataTable model — preserves custom cells).
6. **Orphan CSS** — when a native button/toggle becomes Carbon, delete the now-dead CSS class **in the same PR** (only your own orphans).
7. Run `npm run verify` after each edit. Browser-e2e the flagged files.

### Verified 1:1 token map

`--border`→`--cds-border-subtle` · `--foreground`→`--cds-text-primary` · `--foreground-secondary`→`--cds-text-secondary` · `--foreground-muted`/`--foreground-tertiary`/`--muted-foreground`→`--cds-text-helper` · `--text-inactive`→`--cds-text-disabled` · `--card`/`--surface-elevated`/`--surface-header`→`--cds-layer` · `--surface-hover`→`--cds-layer-hover` · `--muted`/`--secondary`/`--accent`→`--cds-layer-accent` · `--background`→`--cds-background` · `--primary`→`--cds-link-primary` · `--interactive`→`--cds-interactive` · `--ring`→`--cds-border-strong` · `--success`→`--cds-support-success` · `--warning`/`--color-warning`→`--cds-support-warning` · `--destructive`/`--error`/`--error-desat`→`--cds-support-error` · `--primary-foreground`→`--cds-text-inverse` · `--font-mono`→`var(--cds-code-01-font-family)` · `--space-1→02 / -2→03 / -3→04 / -4→05 / -6→06 / -7→07` (cds-spacing) · `--text-xs`/`--text-sm`→`--cds-label-01-font-size` · `--text-base`→`--cds-body-compact-01-font-size`.

## 3. Recommended PR order (shared/leaf FIRST, trivial→complex, ≤2000 LOC/day)

Shared CSS + leaf components first so consumers inherit; orchestrators/tables last.

**B1 — chassis + global hosts (trivial, ~440 LOC).** `chassis/forms/Separator`, `chassis/ToastRegion`, `chassis/forms/Tabs` (keep `.bx--`). e2e: Tabs has-items/badge state. _Lowest risk, unblocks consumers._

**B2 — chassis complex (~410 LOC, e2e).** `chassis/EditorTabBar` (keep roving toolbar, only `×`→Close icon; unit tests must stay green), `chassis/PanelStatus` (spinner→InlineLoading, retry→Button; 6 consumers — high blast). e2e both.

**B3 — dashboard shell/chrome (trivial+CSS, ~600 LOC).** `DashboardShell`, `icon-rail.css`+`IconRail` (together; Lucide→Carbon, 3 icons have no match — see §5), `LogsPanel`, `command-bar.css`+`TopStatusBar` token-only, `panel-container.css`+`PanelContainer` (pair), `ResizableBottomPanel`, `dashboard-page.css`. e2e IconRail nav.

**B4 — overview cards (trivial+1 complex, ~830 LOC, e2e SystemInfoCard).** `overview/HardwareCard`, `overview/ServicesCard`, `OverviewPanel`, `overview/SystemInfoCard` (meterColor `--status-error/--status-warning` → support tokens; 24px metric stays literal; speed-test svg→Renew). Keep dot active/inactive token choice identical across the three.

**B5 — status dropdowns (complex, ~720 LOC, e2e).** `status/LatencyDropdown`, `status/MeshDropdown`, `status/WeatherDropdown` — one PR for consistent popup chrome. Token-only + optional glyph→icon; keep native buttons. status dots are domain viz, keep.

**B6 — map CSS/TS (trivial+moderate, ~550 LOC).** `map/map-overrides.css`, `map/map-markers.css`, `map/map-setup.ts` (NO-OP, confirm deferred), `map/map-colors.ts`, `map/map-helpers.ts` (only `--primary`→link, chart-\* stay), `map/TowerPopup`. Domain paint hex stays literal.

**B7 — map components (complex, ~760 LOC, e2e).** `map/DeviceOverlay` (×→Close, keep native close; flag dead `.affil-select` CSS), `DashboardMap` (514 LOC, biggest; keep MapLibre native locate btn, only icon+tokens; coordinate MAP_UI_COLORS in `dashboard-map-logic.svelte`; preserve 3 exemption headers). e2e map render+locate.

**B8 — RF-propagation (mixed, ~1400 LOC, e2e).** Leaf/trivial first: `RFPropagationControls`, `RFPropagationStatus`, `CloudRFColormapSelector` (gradients stay literal), `RFAdvancedControls`. Then `SessionSelector`, `RFPropagationView` (compute Button + pulse decision), `OverlayControls` (ContentSwitcher+Slider+Button — 3 swaps).

**B9 — map-settings (complex SHARED CSS, ~830 LOC, e2e).** `map-settings-shared.css` FIRST (token-only), then `MapSettingsPanel` (self-contained, Lucide→Carbon), `MapProviderView` (ui/input→TextInput, re-home `.custom-input-row` sizing), `MapLayersView` (12 toggles). **Recommend toggles/ContentSwitcher token-only this phase; defer Toggle conversion** (shared CSS fan-out). e2e all map-settings views.

**B10 — settings/tools/hardware panels (mixed, ~1100 LOC, e2e).** `DevicesPanel`(1 token), `ToolsNavigationView`, `ToolsPanelHeader`, `OnnetToolsPanel`, `hardware-config-panel.css`+`HardwareConfigPanel` (pair), `settings-panel.css`+`SettingsPanel` (pair; 8 svg→Carbon, ClickableTile for hardware card, delete orphan `.open-btn` CSS). e2e SettingsPanel.

**B11 — device tables TRIO (complex SHARED CSS, ~660 LOC, e2e).** `device-table-cells.css` (shared by 3 — also check DevicePriorityTable owner) + `DeviceTable` + `DeviceSubRows` as ONE unit. `DeviceToolbar` + `IntelCategoryView`+`intel-category-view.css`. **Token+button only; DataTable deferred** (exemptions). `getSignalHex` domain stays.

**B12 — Bluetooth/Captures panels (complex, ~1075 LOC, e2e).** `BluetoothPanel` (687) + `CapturesPanel` (387). 3+2 native buttons→Button; keep custom tables (exempt); status hex inside color-mix → support tokens. Mirror status treatment across both.

**B13 — UAS (complex SHARED CSS, ~680 LOC, e2e).** `uas-panel.css` + `UASPanel`. **PR-A only: tokens/hex + Start/Stop Button + status chips→Tag. DataTable = separate PR-B (deferred).** bespoke `--status-*` → support tokens.

**B14 — terminal (complex, ~860 LOC, e2e).** `terminal-theme.ts` (cursor token decision), `TerminalErrorOverlay`, `TerminalShellDropdown`, `TerminalToolbar` (7 icons — confirm names), `TerminalPanel` (parent last; may discharge exemptions). Preserve `.split-btn`/`.more-menu-wrapper` class hooks the parent's `closest()` relies on.

**B15 — dashboard views (complex, split into 2 days).** Day1: `ServiceIframeView`, `ToolUnavailableView`, `DashboardViewRouter`, `webtak/webtak-url-form`, `webtak/webtak-vnc-viewer`, `WebTAKView` (spinner→InlineLoading; `color:var(--background)`→text-inverse), `UASScanView` (~18 domain hex stay). Day2: `ReportsView` (912 LOC — token PR separate from DataTable PR; 13 buttons, Lucide→Carbon). e2e all.

**B16 — TAK forms (complex, ~840 LOC, e2e).** All 7 together: `TakAuthMethodPicker` (keep `.bx--`, drop `hsl()` wrapper — structural), `TakAuthEnroll`, `TakAuthImport`, `TakTruststore` (FileUploader + InlineNotification success), `TakServerForm`, `tak-config-view.css`, (+TakConfigView consumer). Security-sensitive: preserve fetch/upload logic verbatim. `--primary` on FILLED save button → `--cds-interactive` not link-primary.

**B17 — gsm-evil (complex, split, e2e).** Day1: `GsmHeader`, `LiveFramesConsole`, `ScanConsole` (chart-\* stay). Day2 tables: `ScanResultsTable`, `TowerTable` — ui/table→Carbon **Table primitives** (NOT DataTable — expandable/custom cells); signal-quality palette stays literal.

**B18 — routes (mixed, ~660 LOC).** `+error.svelte` (button bg → `--cds-button-primary`/text-on-color), `BottomPanelTabs` (honor Tabs exemption — token+icons only), `gsm-evil-page.css` (flag `--surface-inset/--surface-terminal/--text-status`).

**B19 — recon/cellular (complex, ~840 LOC, e2e).** `trunk-recorder/+page.svelte` + `PresetForm.svelte` together (forms already Carbon; convert 7+4 native buttons, ui/input→TextInput/TextArea, delete orphan `.btn*` CSS).

> Cap note: B8, B12, B15-day1, B16, B19 each near ~800-1400 LOC — keep to one/day. B11/B13/B17 split tables into a 2nd PR. Sequence shared-CSS edit _before/with_ its consumers in every batch.

## 4. Special cases

**DataTable — DEFER ALL to a dedicated table-migration phase** (every one carries Article-IV-4.2 fixed-width-column exemption or custom per-cell rendering): `BluetoothPanel`, `CapturesPanel`, `DeviceTable`, `IntelCategoryView`, `UASPanel`, `ReportsView`, `ScanResultsTable`, `TowerTable` (expandable→Table primitives, not DataTable). **This phase = token+Button+Tag only; keep custom tables.**

**Forms (Carbon TextInput/PasswordInput/TextArea/FileUploader/Toggle):** TAK trio (Enroll/Import/Truststore — FileUploader DOM differs, verify `bind:files[0]`), `TakServerForm`, `MapProviderView`, `webtak-url-form`, `PresetForm`, `+page.svelte` (trunk-recorder).

**Toggles/ContentSwitcher/Slider — defer or token-only:** `MapLayersView` (12 toggles, shared CSS), `MapProviderView`, `gp-config-view.css`/GpConfigView (Toggle), `OverlayControls` (ContentSwitcher+Slider+Button). Converting toggles in shared `map-settings-shared.css` requires migrating ALL consumers same PR — recommend token-only now.

**Shared CSS (migrate WITH consumers, high blast radius):** `device-table-cells.css` (3 consumers + DevicePriorityTable), `map-settings-shared.css` (2-4), `command-bar.css`, `panel-container.css`, `icon-rail.css`, `*-panel.css` pairs, `uas-panel.css`, `intel-category-view.css`, `settings-panel.css`, `tak-config-view.css`, `gp-config-view.css`, `hardware-config-panel.css`, `gsm-evil-page.css`, `dashboard-page.css`.

**DOMAIN / data-viz hex → FLAG, keep literal until charts phase:** map paint (`DashboardMap` uas-lines/circles/rf-ellipse, `map-setup.ts`, `map-colors.ts` SIGNAL*COLORS, `map-helpers.ts` RADIO_COLOR_MAP + `--chart-1..5`), signal/RSSI `getSignalHex`/`getRadioColor` (DeviceTable/SubRows/IntelCategoryView/TowerPopup), RF colormaps (`CloudRFColormapSelector`), log/level colors (`GpOutputConsole`, `ScanConsole` chart-*, `UASScanView` ~18 hex), affiliation colors (`DeviceOverlay` unknown/friendly/hostile), gsm signal-quality scale (`ScanResultsTable`, `TowerTable`), `terminal-theme.ts` 16 ANSI colors. Do NOT flatten to `--cds-support-_`.

**Status-semantic hex → DO map to `--cds-support-*`** (different from data-viz): `--status-healthy #8bbfa0`→success, `--status-warning #d4a054`→warning, `--status-error-panel/--error-desat #c45b4a/#ff5c33`→error — in BluetoothPanel/CapturesPanel/UAS/overview cards/RFPropagationStatus/hardware-config. These sit in `color-mix()` — keep the wrapper, swap the operand.

**Tailwind-class outliers (no `--var` to swap — translate utilities→Carbon components/cds):** `GpOutputConsole`, all `gsm-evil/*`, all TAK form `.svelte` (no `<style>`). `TakAuthMethodPicker` uses `hsl(var(--x)/alpha)` — must **drop the `hsl()` wrapper** (cds vars are full colors), structural change.

**Constitutional exemptions — DO NOT convert (token-only):** `EditorTabBar` roving toolbar, `IconRail` buttons (×2 exemptions), `DashboardMap` locate control, `DeviceOverlay` close, `DeviceToolbar` band-chips/back-btn, custom tables (Bluetooth/Captures/Device/UAS), `DevicesPanel`/`OverviewPanel`/`SettingsPanel`/`ToolsNav` loading-state, `BottomPanelTabs` custom tabs, `TerminalPanel` empty/button. Preserve the comment banners; if a conversion _discharges_ an exemption, update/remove the banner (don't leave stale).

## 5. Token & icon edge-cases (need a human decision)

**Non-1:1 type tokens (no clean Carbon step — pick literal or nearest):**

- `--text-brand` (13px): AgentChatPanel, DeviceOverlay, TowerPopup → literal `0.8125rem` or `--cds-heading-compact-01`.
- `--text-status` (10px) / `--text-section` (9px): DeviceSubRows, device-table-cells.css, DeviceTable, DeviceToolbar, HardwareConfig, TerminalShellDropdown, map-settings-shared, gsm-evil-page.css → keep literal (sub-Carbon dense tactical) or `--cds-label-01-font-size`.
- `gap-2.5` (10px, the `--space-5` analog): TAK forms (Enroll/Import/Truststore/MethodPicker) → no Carbon step; keep literal or `gap-2`/`gap-3`.
- 24px metric (SystemInfoCard), 48px (`+error`), border-radius:0 mil-square (ReportsView) → keep literal.
- `--radius-sm`/`--radius-md`/`--font-weight-semibold`/`--font-weight-medium`/`--letter-spacing-wide`/`-wider` (many files) → **no Carbon token, keep literal.**

**Non-standard vars NOT in the verified map (decide once):**

- `--sidebar` (IconRail) → judgment `--cds-layer`.
- `--separator` (`#ffffff1a` alpha, DeviceSubRows), `--hover-tint` (`#ffffff14`, DeviceToolbar) → alpha overlays, keep literal or color-mix.
- `--status-error`/`--status-warning` (SystemInfoCard meterColor JS) → support tokens.
- `--color-card/--color-muted/--color-primary` (map-settings-shared gradients) → legacy aliases → `--cds-layer`/`-accent`/`link-primary`.
- `--surface-inset`/`--surface-terminal` (gsm-evil-page.css) → `--cds-background` or keep literal.
- `--color-background`/`--color-*` (gsm-evil Tailwind v4 @theme namespace) → confirm cds bridge resolves bare name.
- `--destructive-foreground` (SessionSelector) → `--cds-text-inverse` by analogy.
- `--font-sans`/`--font-primary` ('Geist') → **NO Carbon token; leave literal until P-typography (IBM Plex app-wide).** Don't per-component swap.
- `--top-bar-height`/`--icon-rail-width`/`--panel-width` → layout dims, **keep literal**.

**`--primary` on FILLED buttons (NOT link text) → use `--cds-interactive`/`--cds-button-primary`, not `--cds-link-primary`:** tak-config-view.css save-btn, PresetForm save, `+error` button, RFPropagationView compute, TakConfigView. (`--primary` on links/borders → link-primary as mapped.)

**Cursor/caret color:** `terminal-theme.ts` cursor → `--cds-interactive` not `--cds-link-primary` (judgment).

**Overlay scrims:** `rgba(0,0,0,…)` shadows → keep literal (no Carbon shadow token). `rgba(17,17,17,0.9)`/`rgba(0,0,0,0.7)` backdrops (TerminalErrorOverlay, webtak-vnc) → `--cds-overlay` (verify exists in 0.107) or keep literal.

**Lucide icons with NO clean Carbon match (decide icon set):** IconRail `Radar`/`RadioTower`/`Waypoints`, AgentChatToolbar layers-logo (brand mark — likely keep), DeviceToolbar multi-client glyph, TerminalToolbar split/unsplit/system-logs (confirm names against carbon-icons-svelte exports). Also decide repo-wide: **is `@lucide/svelte` being retired?** (ReportsView, IconRail, MapSettingsPanel, AgentChatToolbar use it) — if kept, icon swaps there become no-ops.

**Tag `type` with no Carbon equivalent:** `variant="outline"` (LiveFramesConsole, ScanConsole, ScanResultsTable) → Carbon Tag has no outline; pick `gray`/`warm-gray`. `animate-pulse` (ScanConsole scanning) → no Carbon equiv, keep utility or drop.
