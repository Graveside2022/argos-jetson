# Spec 024 — Argos Mk II UI Redesign (Fork)

## Status

- **Author:** drafted 2026-04-25
- **Branch:** `feature/024-mk2-redesign`
- **Reference prototype:** `docs/Argos (1).zip` — React/JSX, Babel-standalone, 14 source files + styles.css + 50+ designer screenshots. Extract to `/tmp/argos-redesign/` for in-browser walkthrough; serve via `python3 -m http.server 8765 --directory /tmp/argos-redesign`.
- **Migration plan:** `specs/024-argos-mk2-redesign/plan.md` (in this directory) — user-approved 2026-04-25
- **Supersedes:** spec 012 (Lunaris) — closing addendum will land in PR 11 (flip-day)

## Why

Operators using Argos today land on dense routes with low information hierarchy and no shared chassis between the major subsystems (HackRF, Kismet, GSM Evil, DragonSync, agents). Each route was built standalone with its own header / status indicators / panel chrome. There is no first-class mission concept, no central tool launcher, no consistent left-rail navigation.

The Mk II prototype delivers a unified shell — 56 px icon rail (`--rail-w` in prototype CSS), ARGOS topbar with weather + MGRS + Z-time, 6-tab bottom drawer, statusbar — into which every existing screen plugs. It also introduces three first-class concepts the current UI lacks: **mission metadata** (engagement / operator / target persisted server-side), **a Tools Flyout (⌘K)** that maps to existing routes via a 3-pillar OFFNET/ONNET/OSINT taxonomy, and **a Workflows panel** for tmux session orchestration with full dock-anywhere drag.

The redesign is a **complete fork**, not a layer over Lunaris. New token block in `src/app.css` selected via `[data-ui="mk2"]` (Tailwind v4 `@theme inline` pattern), new chassis components, new screen-\* surfaces. Lunaris ships unchanged in `:root` until the flip-day PR (#11), then deletes.

## User stories

- **US-1** As an operator, every route shares the same 56 px left rail with numeric hotkeys (1–9), so I can switch screens by reflex.
- **US-2** As an operator, the topbar always shows my position (city + lat/lon + MGRS), Zulu time, and a weather button I can click to see METAR + flight-cat + drone/SIGINT GO/NO-GO.
- **US-3** As an operator, the bottom drawer gives me persistent access to terminal / logs / captures / WiFi / Bluetooth / UAS regardless of which screen I'm on. Drag the drawer top edge to resize. Click an active tab to collapse.
- **US-4** As an operator, I can press ⌘K to open a Tools Flyout with a 3-pillar OFFNET/ONNET/OSINT layout and search-as-you-type.
- **US-5** As an operator, I can record mission metadata (engagement / operator / target / link budget) that persists across reloads and survives session end.
- **US-6** As an operator, the AGENTS screen's Workflows panel can dock to any of 4 edges or hide entirely. Drag the header for visual feedback (amber preview band on closest edge); click dock chips for snap-to-edge.
- **US-7** As an operator, I can swap the accent color (5 swatches: amber / green / cyan / magenta / steel) and density (compact / normal / comfy) live via the Tweaks panel. Steel preserves the Lunaris color identity for users who prefer it.

## Acceptance criteria (per phase)

See `plan.md` for per-PR criteria. Top-line:

- All 11 PRs ship behind `?ui=mk2` flag. Existing routes render unchanged when flag absent.
- Heap delta per PR < 10 MB on `/dashboard`.
- No new XHR domains except PR 1 (`/api/weather/metar`) and PR 5 (`/api/missions`).
- Frame time ≤ 16 ms during drawer resize, rail click, ⌘K open, Workflows drag.
- Bundle size delta tracked vs. baseline at each PR. No memory `project_argos_bundle_bloat_context.md` regression.
- PR 11 deletes `palantir-design-system.css` + all legacy chassis, leaves Mk II as the sole UI.

## Out of scope

- Mobile responsive layout (prototype targets 1440 px viewport)
- Light mode (Mk II is dark-only, same as Lunaris)
- Screen-reader / a11y semantics (deferred to follow-up spec)
- Cloud / multi-device sync of localStorage state
