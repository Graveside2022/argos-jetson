# Plan 024 — Argos Mk II UI Redesign

Implementation plan backing `spec.md`. This file is the canonical in-repo source of truth — architecture, tech choices, the 11-PR sequence, locked decisions, reuse map, spike-first gates, and per-PR verification all live below. No external plan reference.

## Architecture summary

```text
src/lib/styles/argos-mk2.css        ◄── standalone Mk II token sheet (forks Lunaris, NOT layered)
                                          │
                                          ▼
src/lib/components/chassis/         ◄── Chassis / Topbar / LeftRail / Statusbar / WeatherButton
                                          │
                                          ▼
src/lib/components/mk2/             ◄── Panel / IconBtn / Metric / Dot / KV / Sparkline / Tweaks
                                          │
                                          ▼
src/lib/state/ui.svelte.ts          ◄── lsState() rune helper, accent / density stores
src/lib/state/workflows-dock.svelte.ts  ◄── dock-anywhere state machine (PR 7)
src/lib/state/rail-pins.svelte.ts   ◄── rail pin order (PR 9)
                                          │
                                          ▼
src/routes/+layout.svelte           ◄── ?ui=mk2 flag gate (PR 1)
src/routes/dashboard/+page.svelte   ◄── Mk II OVERVIEW + MissionStrip (PR 5)
src/routes/api/weather/metar/       ◄── METAR proxy (PR 1)
src/routes/api/missions/            ◄── mission CRUD + activate (PR 5)
src/lib/server/db/migrations/008_*  ◄── missions table (PR 5)
```

## Tech choices

- **Token strategy**: Fork. New `argos-mk2.css` standalone, not layered over `palantir-design-system.css`. Lunaris untouched until PR 11 deletes it.
- **No new dependencies**. SVG and canvas only. No charting / animation / DnD libraries (per memory `feedback_no_install_without_approval.md`).
- **Native HTML5 DnD + window-level pointer listeners** for the dock-anywhere Workflows drag.
- **localStorage** for accent / density / drawer height / pin order / dock state. **SQLite** for missions (server-side persistence).
- **METAR via `aviationweather.gov/api/data/metar`** (free, no key, 15-min TTL cache, disk-cache fallback for offline ops). Geo input from existing GPSd → nearest station via `static/airports.json` (~3 KB gzipped).
- **Svelte 5 runes only.** No legacy stores in new components.
- **CLAUDE.md Rule 3 enforced**: every `.svelte` file edit round-trips through `mcp__svelte-remote__list-sections` → `get-documentation` → `svelte-autofixer` until clean.

## PR sequence (~50 dev-days, 11 PRs)

| #   | Scope                                              | Days |
| --- | -------------------------------------------------- | ---- |
| 1   | Tokens + chassis skeleton + Weather endpoint       | 6    |
| 2   | Primitives + Tweaks panel                          | 2    |
| 3   | Bottom drawer (no drag-reorder)                    | 3    |
| 4   | SYSTEMS screen                                     | 2    |
| 5   | OVERVIEW + Mission Strip backend (`/api/missions`) | 9    |
| 6   | MAP screen (MapLibre into chassis)                 | 3    |
| 7   | AGENTS + Workflows full dock-anywhere              | 14   |
| 8   | Tools Flyout (curated 12-15 tool catalog)          | 2    |
| 9   | Spectrum + SVG waterfall (spike-gated)             | 4    |
| 10  | GSM + Kismet screens                               | 3    |
| 11  | Flip default + Lunaris sunset                      | 2    |

## Decisions locked (2026-04-25)

| Decision           | Choice                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| A4 merge order     | Merged `feature/023-rf-visualization-phase-a4` → `dev` first                 |
| Token strategy     | Fork Mk II as standalone stylesheet                                          |
| Workflows panel    | Full dock-anywhere drag (header + amber preview band + drop-outside-to-hide) |
| Tools Flyout scope | Curated 12-15 tools mapped to existing routes                                |
| Weather button     | Ship full METAR + GO/NO-GO popover in PR 1                                   |
| Mission strip      | Full `/api/missions` endpoint + DB table                                     |

## Reuse map (existing code that backs new screens)

- `src/lib/utils/mgrs.ts` — MGRS conversion for topbar (audit; inline ~30 LOC if absent)
- `src/lib/websocket/` — client WS base class with reconnect (PR 3 drawer terminal)
- `src/lib/server/api/createHandler.ts` — handler factory for new endpoints
- `src/lib/server/db/` — repository pattern; mirror for missions repo
- `src/lib/components/map/RFVisualizationLayer.svelte` — reused as-is (PR 6)
- `src/lib/stores/rf-visualization.svelte.ts` — reused as-is (PR 6)
- `src/routes/api/system/*` — host metrics endpoints (PR 4)
- `src/routes/api/rf/stream/+server.ts` — SSE endpoint (PR 6 + PR 9)
- `tactical/workflows/*.md` — 13 playbooks may inform PR 8 OSINT pillar

## Spike-first gates

1. **PR 9 spike**: SVG waterfall 80×320 @ 10 Hz on Jetson via Chrome DevTools MCP `performance_start_trace`. Decide SVG vs canvas before PR 9 starts. Frame time > 4 ms or heap creep → fall back to `<canvas>` 2D.
2. **PR 7 spike**: HTML5 DnD vs PointerEvents in Svelte 5 for the dock-anywhere state machine. 1-day throwaway branch testing amber preview overlay redraw cost during continuous mousemove.

## Verification per PR

End-to-end via user-scope `mcp__chrome-devtools__*` (chromium :9222 per memory `project_jetson_chrome_devtools.md`):

1. Navigate `localhost:5173/?ui=mk2` and `localhost:5173/` (legacy) — both must render.
2. `list_console_messages` — zero errors, zero warnings.
3. `list_network_requests` — confirm no new XHR domains beyond intentional.
4. `take_memory_snapshot` — heap delta within 10 MB per PR vs. baseline.
5. `performance_start_trace` → interact → `_stop_trace` — frame time ≤ 16 ms.
6. `npm run build` — bundle delta tracked vs. baseline.
7. `npm run test:unit` filtered to changed components.

Visual diff vs prototype: extract `docs/Argos (1).zip` to `/tmp/argos-redesign/` and serve locally for live comparison. Side-by-side screenshots vs each PR's chassis output.

## Anti-scope callouts

- NO new charting / animation / DnD deps (Jetson 8 GB budget)
- NO `npm install` without explicit approval
- NO `svelte-check` while dashboard is live (650 MB + 200 MB > safe zone)
- NO synthetic data injection into `rf_signals.db` (memory `feedback_no_synthetic_data.md`)
- NO `hooks.server.ts` modification through PR 1-11
- Per memory `project_argos_commit_always_bg.md`: every commit on this branch runs in background (typecheck + tests = 2-3 min)
