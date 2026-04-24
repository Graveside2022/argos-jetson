# Tasks 023 — RF Visualization

Retro-fill of Phase A.1–A.3 (shipped) + skeleton for Phase A.4 (not started). Commit SHAs are from branch `feature/rf-visualization-phase-a3`.

## Phase A.1 — Backend aggregation

- [x] **T001** Add `sessions` table + `signals.session_id` column + `idx_signals_device_time` via migration `006_add_sessions_and_device_time_index.sql`. Backfill pre-migration rows to `'legacy'` bucket. — commit `87ccaa98`
- [x] **T002** Implement `session-tracker.ts`: `startNewSession`, `endCurrentSession`, `getCurrentSessionId`, `listSessions`. Sources: `kismet-start` | `manual` | `auto` | `legacy`. — commit `87ccaa98`
- [x] **T003** Implement `rf-aggregation.ts`: `getRssiHexCells` (H3 binning, hard cap 10k features, default res 11), `getApCentroids` (RSSI-weighted), `getDrivePath` (sampled track). — commit `87ccaa98`
- [x] **T004** Wire signal-persistence hook to stamp every incoming signal with `getCurrentSessionId()`. Emit `startNewSession('kismet-start')` from `/api/kismet/start`. — commit `87ccaa98`
- [x] **T005** Unit + integration tests: `tests/unit/rf-aggregation.test.ts`, `tests/integration/api-rf-aggregate.test.ts`. — commit `87ccaa98`

## Phase A.2 — Dashboard wire-up (drive-path + centroids)

- [x] **T006** Create `rf-visualization.svelte.ts` client store with filter-key LRU cache (size 5) and layer-mode flag. — commit `fe13bb48`
- [x] **T007** Add MapLibre source + layer for drive path (line layer, current session). — commit `fe13bb48`
- [x] **T008** Add MapLibre source + layer for AP centroids (symbol layer). — commit `fe13bb48`
- [x] **T009** Verify in a live browser that both layers render against a real session (Chrome DevTools MCP). — commit `fe13bb48`

## Phase A.3 — Heatmap, sessions, highlight-on-select

- [x] **T010** (**C1**) Add `getDeviceObservations` to `rf-aggregation.ts` + `/api/rf/observations` route. — commit `7af170e9`
- [x] **T011** (**C2**) Wire RSSI heatmap MapLibre layer + layer-panel toggle. Color scale bound to meanDbm. — commit `5c2d12f2`
- [x] **T012** (**C3**) Session selector dropdown in dashboard UI + store state for active session id. `/api/sessions` GET + POST wired to "New Session" button. — commit `0e6b60f1`
- [x] **T013** (**C4a**) Highlight-on-select: observation rings + rays to centroid + dim-others treatment for non-selected APs. — commit `00373174`
- [x] **T014** (**C4b**) Stale-guard the highlight fetch against fast AP-switches (response-token match before applying result). — commit `6195714f`

## Phase A.3 adjacent (infra, same branch)

- [x] **T015** Prevent `rf_signals.db-wal` rebloom — checkpoint timer + per-query handle close. WAL observed at 4.4 GB before fix, now returns `0|0|0` from passive pragma. — commit `41f4faa6`
- [x] **T016** Remove `@opentelemetry/*` packages — saves 14 MB off the server bundle. Re-add to `dependencies` (not `devDependencies`) if ever restored. — commit `0ea35341`
- [x] **T017** `mem-guard.sh` RAM-aware heap tiering — `/proc/meminfo` → 1024/2048/3072/4096 tiers. Flat 1536 cap was OOMing the adapter-node SSR assembly. — commit `aa18ff90`

## Phase A.4 — Not started (skeleton)

Candidates surfaced in the Step 5 brainstorm. Pick one track, write acceptance criteria, then expand into Txxx rows.

- [ ] **T018** Time-scrubber on sessions. Needs: UI slider bound to `start`/`end` query params; `/api/rf/aggregate` already accepts them; store needs a debounced fetch on slider drag.
- [ ] **T019** Per-device drill-down panel. Needs: click-to-select surface on centroid, panel component showing frequency / channel / vendor / obs-count. Store already has `deviceIds` filter wired — UI surface doesn't expose it yet.
- [ ] **T020** Dynamic centroid clustering. Needs: MapLibre `cluster: true` on the centroid source, cluster-color ramp, click-to-zoom-expand behavior. Acceptance: at z=10 a 2k-AP city does not render 2,000 overlapping dots.
- [ ] **T021** Code-splitting for `process-manager.js` (1.86 MB server chunk). Track adjacent to Phase A.4 or defer to dedicated infra PR.
- [ ] **T022** Fix `hooks.server.ts` top-level `scanAllHardware()` side-effect — runs during `npm run build` SSR assembly. Move behind a server-start hook or lazy-init.

## Phase B — Deferred

- [ ] Cross-session AP fusion ("show me AP-X across all runs") — needs device-level view or denormalized rollup.
- [ ] Offline tile caching of the heatmap.
- [ ] WebGL-accelerated custom MapLibre layer if hex cell count ever exceeds the 10k cap.
