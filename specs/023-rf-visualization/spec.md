# Spec 023 — RF Visualization (Flying-Squirrel style)

## Status

- **Author:** retro-filled 2026-04-24 after Phase A.1–A.3 shipped without a spec
- **Phase A.1–A.3:** complete on branch `feature/rf-visualization-phase-a3`
- **Phase A.4:** scoped below, not started

## Why

Operators running an Argos mission need a map-first view of the RF environment they have collected, not a table of signal rows. The Flying-Squirrel toolchain (Wigle + Kismet heatmap overlays) is the de-facto visual grammar for this — heatmap hex cells for signal strength, AP centroids where a transmitter probably lives, and a drive path showing where the operator has been. Argos needs the same grammar, fed from the `rf_signals.db` the dashboard already writes.

Before this work, `rf_signals.db` accumulated observations with no visual consumer. Operators could not answer "where is the strongest WiFi AP in this area" or "did I already cover this street" without exporting to external tools.

## User stories

- **US-1** As an operator, I can open the dashboard map and see a heatmap of signal strength binned into H3 hex cells, colored by mean dBm. I can toggle the layer off. _(shipped A.3 C2)_
- **US-2** As an operator, I can see an AP centroid marker for each unique `device_id` placed at the RSSI-weighted centroid of its observations, not at a random sample. _(shipped A.2)_
- **US-3** As an operator, I can see the drive path I travelled during the current mission, so I know what I have and have not covered. _(shipped A.2)_
- **US-4** As an operator, I can bound all three layers to a specific session (mission-like bucket), so viewing historical runs does not pollute the current heatmap. _(shipped A.3 C3)_
- **US-5** As an operator, I can click an AP centroid and see a halo of observation points with rays connecting them to the centroid, with all other APs dimmed for focus. _(shipped A.3 C4)_
- **US-6** As an operator (Phase A.4), I can scrub a timeline slider to replay a session temporally and watch the heatmap evolve. _(not shipped)_
- **US-7** As an operator (Phase A.4), at low zoom the centroid layer clusters AP markers so a busy city block does not render 2,000 overlapping dots. _(not shipped)_
- **US-8** As an operator (Phase A.4), I can open a per-device drill-down panel showing frequency, channel, vendor, and observation count from the clicked AP. _(not shipped)_

## Acceptance criteria

- Heatmap, centroid, and path layers render from a single `/api/rf/aggregate` call with `layer=all`.
- Highlight-on-select fetch is guarded against fast AP-switches (stale response must not overwrite a newer selection).
- Session selector lists the 50 most recent sessions + the currently open one.
- All layers honor the session filter when a session is selected; empty selection means "current session only."
- Lock file and `package.json` stay in sync (no drift from unpinned deps).
- Typecheck passes with 0 errors. Unit tests all pass. Production build succeeds.

## Non-functional

- **Performance:** aggregation returns in < 500 ms for 100k-row sessions at H3 res 11. Hex cell count is hard-capped at 10,000 features to prevent MapLibre starvation.
- **Memory:** Node-side aggregation stays under the existing Argos heap budget. No separate H3 SQLite extension is introduced.
- **Auth:** `/api/rf/*` and `/api/sessions` inherit the global fail-closed API-key gate in `src/hooks.server.ts`. No route-specific auth added.
- **WAL hygiene:** the `rf_signals.db` WAL file must not rebloom during long-running sessions (fix landed in commit `41f4faa6`).
- **Client cache:** the store keeps an LRU of 5 filter-fingerprint → response entries to avoid re-fetching on pan/zoom with identical filters.

## Out of scope

- Server-side streaming of aggregation results. All layers return whole-response JSON.
- Cross-session heatmap fusion ("show me AP-X across all runs"). Session-scoped only.
- WebGL-accelerated custom MapLibre layers. Standard source/layer pairs only.
- Offline tile caching of the heatmap.
