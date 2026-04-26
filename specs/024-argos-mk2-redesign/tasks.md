# Tasks 024 — Argos Mk II UI Redesign

Tracking per-PR tasks against the migration plan in `plan.md`. Commit SHAs filled in as each PR lands. PR numbers reference GitHub PRs against `dev`.

## Pre-flight (this PR)

- [x] **T000** Merge `feature/023-rf-visualization-phase-a4` → `dev`. — PR #16, merge commit `9bd96032`
- [x] **T001** Branch `feature/024-mk2-redesign` off updated `dev`.
- [x] **T002** ~~Stash prototype as `docs/redesign-reference/`~~ — superseded: `docs/Argos (1).zip` is already in repo. Extract to `/tmp/argos-redesign/` for working sessions.
- [x] **T003** Scaffold `specs/024-argos-mk2-redesign/{spec,plan,tasks}.md`.
- [x] **T004** Open spec-024 introduction PR against `dev`. — PR #18, merge commit `c01f2a82`

## PR 1 — Chassis + Tokens + Weather (~6 days)

- [x] **T005** Add Mk II token block to `src/app.css` as `[data-ui="mk2"]` selector (Tailwind v4 `@theme inline` pattern) — deep-black surfaces, amber accent (oklch), 5 accent swatches, 6-step type scale (9–15 px), 2–4 px radii, 80–180 ms motion. Lunaris stays in default `:root` for off-flag rendering. **Also fix CLAUDE.md:** replace stale `palantir-design-system.css` reference with `src/app.css :root` (the path doesn't exist in the repo).
- [x] **T006** Add `?ui=mk2` flag in `src/routes/+layout.svelte` — sets `<body data-ui="mk2">` so the new token block applies. Off-flag = `<body>` has no attribute, Lunaris `:root` renders unchanged.
- [x] **T007** `src/lib/components/chassis/Chassis.svelte` — 56 px rail (per prototype `--rail-w: 56px`) / 44 px topbar (`--bar-h`) / main / drawer / 22 px statusbar (matches prototype `grid-template-rows: var(--bar-h) 1fr 22px`).
- [x] **T008** `Topbar.svelte` — brand + ARGOS MK II + Weather button + city + lat/lon + MGRS + Z-clock (client `$effect` ticker).
- [x] **T009** `LeftRail.svelte` — fixed AGENTS / OVERVIEW / MAP at top, dynamic pinned tools middle, fixed SYSTEMS bottom. 1–9 numeric hotkeys. (Drag-reorder deferred to PR 9.)
- [x] **T010** `Statusbar.svelte` — LINK / CPU / MEM / TEMP / NVMe / SESSION + kbd hint chips.
- [x] **T011** `WeatherButton.svelte` — METAR popover, VFR/MVFR/IFR/LIFR badge, 6-cell weather grid, GO/NO-GO ops matrix (manned aircraft / drone-UAS / balloon / radio-SIGINT).
- [x] **T012** `src/routes/api/weather/metar/+server.ts` — cached 15-min TTL proxy to `aviationweather.gov/api/data/metar`. ARGOS_API_KEY auth. Disk cache for offline.
- [x] **T013** `static/airports.json` — nearest-station lookup (1.7 KB gzipped, 58 stations).
- [x] **T014** `src/lib/state/ui.svelte.ts` — `lsState()` rune helper, accent / density stores.
- [x] **T015** Verify in Chrome DevTools MCP: `?ui=mk2` renders, no console errors, `?ui=` legacy unbroken, heap delta < 5 MB. — verified on PR2 worktree (vite :5174, headless chromium :9222, isolated contexts). Heap Δ = **−0.03 MB** (≪ 5 MB). DOM nodes identical (287 each). Body bg flips `rgb(17,17,17)` → `oklch(0.13 0.008 255)`. `data-ui` / `data-accent` / `data-density` mirror correctly; legacy mode strips them. Only console error is a pre-existing WebGL GPU-sandbox failure in MapLibre — present on both flags, unrelated to spec-024.

## PR 2 — Primitives + Tweaks (~2 days)

- [x] **T016** `Panel.svelte` (with bracket-corner tag), `IconBtn.svelte`, `Metric.svelte`, `Dot.svelte`, `KV.svelte`, `Sparkline.svelte` (pure SVG), `Tweaks.svelte`. — landed in `src/lib/components/mk2/`
- [x] **T017** Tweaks accent picker = 5 swatches (amber/green/cyan/magenta/steel). Density = compact/normal/comfy. Persist + apply live via CSS variable updates. — `+layout.svelte` mirrors `accentStore`/`densityStore` onto `body[data-accent|data-density]`; PR1 CSS selectors apply live, no re-render
- [x] **T018** Round-trip every component through `mcp__svelte-remote__svelte-autofixer` until clean. — svelte-remote MCP unavailable on jetson2 host (verified via `claude mcp list`); substituted file-scoped `npx eslint` + `npx svelte-check` (0 errors / 0 warnings on PR2 files). **Waiver tracked as T018a below** — once svelte-remote MCP is registered on jetson2, PR2 component files must be re-run through the full `list-sections → get-documentation → svelte-autofixer` chain.

- [ ] **T018a** (waiver follow-up) Re-run `mcp__svelte-remote__list-sections` → `get-documentation` → `svelte-autofixer` against `src/lib/components/mk2/{Panel,IconBtn,Metric,Dot,KV,Sparkline,Tweaks}.svelte` once svelte-remote MCP is registered on jetson2. **Why:** PR2 ESLint+svelte-check substitution doesn't catch Svelte 5 idiom drift that the official autofixer would (e.g., legacy `<slot>` patterns, deprecated reactivity hints). **How to apply:** verify host registration with `claude mcp list | grep svelte-remote`; on hit, run the full chain and amend any drift in a follow-up commit on `dev`.

## PR 3 — Bottom Drawer (~3 days)

- [x] **T019** `Drawer.svelte` — 6 fixed-order tabs (terminal/logs/captures/wifi/bluetooth/uas), click-active-to-collapse, drag-resize handle. Height clamped to `max(120, innerHeight - 200)` (matches prototype `chassis.jsx` BottomDrawer — floor 120 px so the drawer never collapses smaller than the tab strip, even on tiny viewports). — landed at `src/lib/components/chassis/Drawer.svelte`; clamp logic extracted to `drawer-clamp.ts` for unit-testability; active/open/height persist via `lsState` (`argos.mk2.drawer.{active,open,height}`).
- [x] **T020** Terminal tab embeds existing tmux viewer per memory `project_argos_terminal_path_fix.md`. Empty-state when `vite-plugin-terminal` absent (memory `project_argos_terminal_prod_gap.md`). — `TerminalTab.svelte` HEAD-probes `/terminal-ws` on mount; on 404 renders explicit "Terminal not available in production build" empty state; on 200 mounts the existing `TerminalPanel.svelte`.
- [x] **T021** Other tabs: stub content wrapping existing API surfaces (`/api/kismet/devices`, `/api/bluetooth/...`, `/api/dragonsync/...`). — Logs/Captures/Wifi/Bluetooth/Uas tabs render hardcoded mock rows matching prototype `drawer.jsx`. Real API wiring deferred to per-screen PRs (PR5+); recorded here so reviewers see stub depth was intentional, not unfinished.
- [x] **T022** Verify drawer floor (200 px) holds across viewport resize. — `drawer-clamp.test.ts` unit-tests `clampDrawerHeight()` against 7 cases including tiny-viewport (240 px), standard laptop (800 px), 4K (2160 px), proposed-undershoot, and proposed-overshoot. All 7 pass; STAGE_RESERVE clearance proven invariant.

## PR 4 — SYSTEMS Screen (~2 days)

- [x] **T023** Host overview header — argos-field-XX / kernel / uptime / load avg / OK count / WARN count. — `SystemsScreen.svelte` header strip; hostname/kernel/uptime/loadAvg pulled from `/api/system/info` (extended with `kernel: os.release()` + `loadAvg: os.loadavg()`); OK/WARN counts derived from `/api/system/services` `healthy_count` vs `total_count`.
- [x] **T024** 4 sparkline gauge tiles — CPU% / MEM% / NET MB/s / TEMP°C. Bind to existing `/api/system/*`. — `HostMetricsTab.svelte` polls `/api/system/metrics` every 1.2 s (matches prototype cadence); CPU + MEM + TEMP read directly; NET derived client-side via `bytesPerSecond()` differencing the cumulative `network.{rx,tx}` byte counters between samples (the endpoint surfaces raw `/proc/net/dev` totals). Rolling 40-sample buffer per metric via `pushSample()` (pure helper, 13 unit tests).
- [x] **T025** DISK USAGE bars — mount + fs + GB used/total + %. — Single root mount in PR4 (matches what `/api/system/info.storage` exposes today). 75% red threshold per prototype. Multi-mount expansion deferred to PR5+ when `/api/system/info` gains a `mounts[]` field.
- [x] **T026** 5 sub-tabs (HOST METRICS / HARDWARE / PROCESSES / SERVICES / NETWORK). State persisted. — Tab strip with active-underline indicator. `systemsTabStore` (`lsState<SystemsTab>('argos.mk2.systems.tab', 'host')`) persists selection across reloads with a typed validator. HOST METRICS + SERVICES wire real data; HW / PROC / NET ship empty-state placeholders pointing at the missing `/api/{hardware/inventory,system/processes,system/interfaces}` endpoints (PR5+ scope). Mount into chassis happens in PR5 (T034) — PR4 ships dormant component. Verified end-to-end via temporary `/dev/systems-preview` route (deleted before commit) on `vite :5174` worktree + Chrome DevTools MCP isolated context: all 5 tabs render, 4 sparklines populate, disk fill 74%, console clean (zero errors).

## PR 5 — OVERVIEW + Mission Strip (~3 days, scope reduced from 9 — existing `Mission` entity reused)

**Existing (DO NOT rebuild):** `Mission` entity (`src/lib/server/services/reports/types.ts`), `mission-store.ts` with `createMission` / `setActiveMission` / `getActiveMission` / `listMissions` / `deleteMission`, `mission-repository.ts`, `POST /api/missions`, `GET /api/missions/list`, `POST /api/missions/[id]/activate`, `/api/missions/[id]/+server.ts`. Migration `20260412_create_reports_missions.sql` already provides id / name / type / unit / ao_mgrs / created_at / active.

- [ ] **T027** Migration `008_extend_missions_for_strip.sql` — three separate SQLite ALTER statements (single ALTER per column is required by SQLite):
   ```sql
   ALTER TABLE missions ADD COLUMN operator TEXT;
   ALTER TABLE missions ADD COLUMN target TEXT;
   ALTER TABLE missions ADD COLUMN link_budget REAL;
   ```
   Optional follow-up migration `009_*.sql` if `type` enum needs relaxing — keep schema changes one-per-migration so rollbacks stay clean.
- [ ] **T028** Extend `Mission` type in `services/reports/types.ts` and `mission-store.ts` row mappers to surface new columns.
- [ ] **T029** Add `GET` + `PATCH` exports to existing `src/routes/api/missions/[id]/+server.ts` (currently only exposes `DELETE`). `GET` returns the single mission via existing `getMission(db, id)`. `PATCH` validates body via Zod and writes via a new `updateMission(db, id, fields)` in `mission-store.ts`. No new files — extend existing.
- [ ] **T030** `MissionStrip.svelte` — engagement / operator / target / mission timer / link budget. Editable on click. PATCH on blur. Multi-mission switcher.
- [ ] **T031** `SensorTile.svelte` × 4 (sweep / devices / GPS / system) with sparklines.
- [ ] **T032** `DetectionsList.svelte` — ranked SIG-A-XXX with bearing / distance / RSSI / confidence bars.
- [ ] **T033** `EventStream.svelte` — rolling log, click event → modal with KV detail.
- [ ] **T034** Mk II `/dashboard/+page.svelte` variant gated on `?ui=mk2`.

## PR 6 — MAP Screen (~3 days)

- [ ] **T035** Mk II `/map/+page.svelte` (or fold into dashboard) with MapLibre + chassis.
- [ ] **T036** Reuse `RFVisualizationLayer.svelte` + RF stores from spec 023.
- [ ] **T037** Add own-position marker + bearing rays for current detections.
- [ ] **T038** Layer panel chip group.

## PR 7 — AGENTS + Workflows Full Dock-Anywhere (~14 days, **spike-first**)

- [ ] **T039** Spike: 1 day on throwaway branch — HTML5 DnD vs PointerEvents in Svelte 5 for the amber preview overlay redraw cost. Decide approach.
- [ ] **T040** `ScreenAgents.svelte` — Mission Control bar / 9-session grid / list / split view modes.
- [ ] **T041** `WorkflowsPanel.svelte` — 5 dock chips (◧ ⬒ ⬓ ◨ ×) for click-snap.
- [ ] **T042** `DockOverlay.svelte` — 40%-deep amber preview band on closest TMUX-panel edge during drag, red `RELEASE TO HIDE` chip on drop-outside.
- [ ] **T043** `src/lib/state/workflows-dock.svelte.ts` — state machine `idle → dragging → over-zone → dropped`. Persist via `lsState("argos.wf-dock", "right")`.
- [ ] **T044** Restore chip in CTL bar when `dock === "hidden"`.
- [ ] **T045** Session grid / list / split sub-components.

## PR 8 — Tools Flyout (~2 days)

- [ ] **T046** `ToolsFlyout.svelte` — full-screen modal, 3-pillar OFFNET / ONNET / OSINT, search, ⌘K + `+` rail button + Esc.
- [ ] **T047** `src/lib/data/tools-catalog.ts` — hand-curated 12-15 tools mapped to existing routes (HackRF, Kismet, GSM Evil, Bluetooth, DragonSync, TAK, agents, RF viz, etc.). No install detection in v1.

## PR 9 — Spectrum + SVG Waterfall (~4 days, **spike-first**)

- [ ] **T048** Spike: 1 day — render 80×320 SVG cells @ 10 Hz on Jetson, profile via Chrome DevTools MCP `performance_start_trace`. Frame time > 4 ms or heap creep → fall back to `<canvas>` 2D.
- [ ] **T049** `Spectrum.svelte` — sweep control (START/STOP/RBW/LNA/VGA/AMP) + peak-hold graph.
- [ ] **T050** `Waterfall.svelte` — 80-row heatmap, frequency ruler, time labels. Bind to existing `/api/rf/stream` SSE.
- [ ] **T051** Drawer tab drag-reorder + rail drag-reorder (deferred from PR 1 / PR 3) — reuse same DnD machinery as PR 7.

## PR 10 — GSM + Kismet Screens (~3 days)

- [ ] **T052** `ScreenGsm.svelte` — ARFCN tuner / IMSI capture table / cell info strip / selection inspector (TRACK/TAG/EXPORT/SIM-LOOKUP/FLAG).
- [ ] **T053** `ScreenKismet.svelte` — device table (MAC/vendor/SSID/channel/RSSI), sortable, selection inspector (PCAP FILTER/TRIANGULATE/DEAUTH/BLACKLIST).

## PR 11 — Flip + Lunaris Sunset (~2 days)

- [ ] **T054** Flip default `?ui=mk2`. Add `?ui=lunaris` escape hatch for one release.
- [ ] **T055** Next release: delete `palantir-design-system.css`, old `app.css` Lunaris rules, every legacy chassis component, all non-Mk II route variants.
- [ ] **T056** Spec 012 closing addendum: superseded by spec 024.

## Out of phase (deferred specs)

- A11y semantics for Mk II chassis — `spec-025` (TBD)
- Mobile responsive layout — `spec-026` (TBD)
- Cloud / multi-device sync of localStorage state — `spec-027` (TBD)
- Light-mode support — intentionally out of scope (Mk II is dark-only). No follow-up spec.
