# Tasks 024 — Argos Mk II UI Redesign

Tracking per-PR tasks against the migration plan in `plan.md`. Commit SHAs filled in as each PR lands. PR numbers reference GitHub PRs against `dev`.

## Pre-flight (this PR)

- [x] **T000** Merge `feature/023-rf-visualization-phase-a4` → `dev`. — PR #16, merge commit `9bd96032`
- [x] **T001** Branch `feature/024-mk2-redesign` off updated `dev`.
- [x] **T002** ~~Stash prototype as `docs/redesign-reference/`~~ — superseded: `docs/Argos (1).zip` is already in repo. Extract to `/tmp/argos-redesign/` for working sessions.
- [x] **T003** Scaffold `specs/024-argos-mk2-redesign/{spec,plan,tasks}.md`.
- [ ] **T004** Open spec-024 introduction PR against `dev`.

## PR 1 — Chassis + Tokens + Weather (~6 days)

- [ ] **T005** Add Mk II token block to `src/app.css` as `[data-ui="mk2"]` selector (Tailwind v4 `@theme inline` pattern) — deep-black surfaces, amber accent (oklch), 5 accent swatches, 6-step type scale (9–15 px), 2–4 px radii, 80–180 ms motion. Lunaris stays in default `:root` for off-flag rendering. **Also fix CLAUDE.md:** replace stale `palantir-design-system.css` reference with `src/app.css :root` (the path doesn't exist in the repo).
- [ ] **T006** Add `?ui=mk2` flag in `src/routes/+layout.svelte` — sets `<body data-ui="mk2">` so the new token block applies. Off-flag = `<body>` has no attribute, Lunaris `:root` renders unchanged.
- [ ] **T007** `src/lib/components/chassis/Chassis.svelte` — 56 px rail (per prototype `--rail-w: 56px`) / 44 px topbar (`--bar-h`) / main / drawer / 22 px statusbar (matches prototype `grid-template-rows: var(--bar-h) 1fr 22px`).
- [ ] **T008** `Topbar.svelte` — brand + ARGOS MK II + Weather button + city + lat/lon + MGRS + Z-clock (client `$effect` ticker).
- [ ] **T009** `LeftRail.svelte` — fixed AGENTS / OVERVIEW / MAP at top, dynamic pinned tools middle, fixed SYSTEMS bottom. 1–9 numeric hotkeys. (Drag-reorder deferred to PR 9.)
- [ ] **T010** `Statusbar.svelte` — LINK / CPU / MEM / TEMP / NVMe / SESSION + kbd hint chips.
- [ ] **T011** `WeatherButton.svelte` — METAR popover, VFR/MVFR/IFR/LIFR badge, 6-cell weather grid, GO/NO-GO ops matrix (manned aircraft / drone-UAS / balloon / radio-SIGINT).
- [ ] **T012** `src/routes/api/weather/metar/+server.ts` — cached 15-min TTL proxy to `aviationweather.gov/api/data/metar`. ARGOS_API_KEY auth. Disk cache for offline.
- [ ] **T013** `static/airports.json` — nearest-station lookup (~3 KB gzipped).
- [ ] **T014** `src/lib/state/ui.svelte.ts` — `lsState()` rune helper, accent / density stores.
- [ ] **T015** Verify in Chrome DevTools MCP: `?ui=mk2` renders, no console errors, `?ui=` legacy unbroken, heap delta < 5 MB.

## PR 2 — Primitives + Tweaks (~2 days)

- [ ] **T016** `Panel.svelte` (with bracket-corner tag), `IconBtn.svelte`, `Metric.svelte`, `Dot.svelte`, `KV.svelte`, `Sparkline.svelte` (pure SVG), `Tweaks.svelte`.
- [ ] **T017** Tweaks accent picker = 5 swatches (amber/green/cyan/magenta/steel). Density = compact/normal/comfy. Persist + apply live via CSS variable updates.
- [ ] **T018** Round-trip every component through `mcp__svelte-remote__svelte-autofixer` until clean.

## PR 3 — Bottom Drawer (~3 days)

- [ ] **T019** `Drawer.svelte` — 6 fixed-order tabs (terminal/logs/captures/wifi/bluetooth/uas), click-active-to-collapse, drag-resize handle. Height clamped to `max(120, innerHeight - 200)` (matches prototype `chassis.jsx` BottomDrawer — floor 120 px so the drawer never collapses smaller than the tab strip, even on tiny viewports).
- [ ] **T020** Terminal tab embeds existing tmux viewer per memory `project_argos_terminal_path_fix.md`. Empty-state when `vite-plugin-terminal` absent (memory `project_argos_terminal_prod_gap.md`).
- [ ] **T021** Other tabs: stub content wrapping existing API surfaces (`/api/kismet/devices`, `/api/bluetooth/...`, `/api/dragonsync/...`).
- [ ] **T022** Verify drawer floor (200 px) holds across viewport resize.

## PR 4 — SYSTEMS Screen (~2 days)

- [ ] **T023** Host overview header — argos-field-XX / kernel / uptime / load avg / OK count / WARN count.
- [ ] **T024** 4 sparkline gauge tiles — CPU% / MEM% / NET MB/s / TEMP°C. Bind to existing `/api/system/*`.
- [ ] **T025** DISK USAGE bars — mount + fs + GB used/total + %.
- [ ] **T026** 5 sub-tabs (HOST METRICS / HARDWARE / PROCESSES / SERVICES / NETWORK). State persisted.

## PR 5 — OVERVIEW + Mission Strip (~3 days, scope reduced from 9 — existing `Mission` entity reused)

**Existing (DO NOT rebuild):** `Mission` entity (`src/lib/server/services/reports/types.ts`), `mission-store.ts` with `createMission` / `setActiveMission` / `getActiveMission` / `listMissions` / `deleteMission`, `mission-repository.ts`, `POST /api/missions`, `GET /api/missions/list`, `POST /api/missions/[id]/activate`, `/api/missions/[id]/+server.ts`. Migration `20260412_create_reports_missions.sql` already provides id / name / type / unit / ao_mgrs / created_at / active.

- [ ] **T027** Migration `008_extend_missions_for_strip.sql` — `ALTER TABLE missions ADD COLUMN operator TEXT; ADD COLUMN target TEXT; ADD COLUMN link_budget REAL`. Optional: relax `type` enum to add `'field-rotation'` (or remove constraint entirely).
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
