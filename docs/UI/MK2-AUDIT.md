# Mk II Visual-Parity Audit — JSX Prototype vs Svelte Port

**Date:** 2026-04-28  
**Scope:** 19 surfaces — 5 chassis + 7 drawer/flyout + 7 screens  
**Reference:** `/tmp/argos-design-ref/` (extracted from `docs/Argos (1).zip`)  
**Live URL:** <http://127.0.0.1:5173/dashboard/mk2/overview> (`data-ui="mk2"` confirmed)

This is Phase 1 of the 4-phase visual-parity sweep. **No code changed in this phase.** Output here drives Phase 2 (token fixes + Geist Mono install) and Phase 3 (per-surface fix PRs).

---

## Executive summary — three categories of divergence

1. **Token-level (one fix propagates everywhere)** — `--mk2-fs-*` tokens are 0.5-1.5 px smaller than JSX design + `--mk2-f-mono` prioritizes Fira Code instead of Geist Mono. Single edit in `src/app.css` repairs ~15 surfaces simultaneously.
2. **Per-surface CSS drift** — minor letter-spacing, padding, gap differences in some places. Surface-by-surface fixes.
3. **Missing implementations** — AGENTS screen is placeholder only, SPECTRUM data wiring incomplete, GSM-EVIL missing console panel, Tools Flyout missing keybind footer + right detail pane.

---

## CHASSIS SURFACES (5)

### 1. Topbar (`Topbar.svelte` vs `chassis.jsx::Topbar()`)

| Property                   | JSX intent | Svelte port              | Gap            |
| -------------------------- | ---------- | ------------------------ | -------------- |
| topbar-section font-size   | **11px**   | `var(--mk2-fs-3) = 10px` | -1px           |
| topbar-section font-family | Geist Mono | Fira Code (fallback)     | wrong typeface |
| letter-spacing             | 0.06em     | 0.06em                   | ✅             |
| gap                        | 14px       | 14px                     | ✅             |

**Structural notes:** Svelte adds Settings + Tweaks modal (spec-024 PR1 T008) — extension, not regression. Color binding identical.

### 2. Left Rail (`LeftRail.svelte` vs `chassis.jsx::Rail()`)

| Property           | JSX intent | Svelte port              | Gap                   |
| ------------------ | ---------- | ------------------------ | --------------------- |
| rail-num font-size | **10.5px** | `var(--mk2-fs-1) = 9px`  | **-1.5px (most off)** |
| rail-btn height    | 44px       | 44px                     | ✅                    |
| transition timing  | ~120ms     | `var(--mk2-mo-1) = 80ms` | -40ms                 |

**Structural notes:** Svelte adds 1-9 hotkey handlers + ARIA attrs — extension.

### 3. Bottom Drawer Tab Bar (`Drawer.svelte::tabs` vs `chassis.jsx::BottomDrawer`)

| Property               | JSX intent                               | Svelte port              | Gap            |
| ---------------------- | ---------------------------------------- | ------------------------ | -------------- |
| drawer-tab font-size   | **10.5px**                               | `var(--mk2-fs-2) = 10px` | -0.5px         |
| drawer-tab font-family | Geist Mono                               | Fira Code (fallback)     | wrong typeface |
| letter-spacing         | 0.08em                                   | 0.08em                   | ✅             |
| active underline       | 1px accent at top -1px                   | identical                | ✅             |
| number color           | active: `--accent` / inactive: `--ink-4` | exact match              | ✅             |

**Structural notes:** Drag-reorder deferred to PR9 (T051). Click-to-collapse logic identical.

### 4. Statusbar (`Statusbar.svelte` vs `chassis.jsx::Statusbar()`)

| Property              | JSX intent           | Svelte port              | Gap            |
| --------------------- | -------------------- | ------------------------ | -------------- |
| statusbar font-size   | **10.5px**           | `var(--mk2-fs-2) = 10px` | -0.5px         |
| statusbar font-family | Geist Mono           | Fira Code (fallback)     | wrong typeface |
| letter-spacing        | 0.04em               | 0.04em                   | ✅             |
| cell padding          | 0 10px               | 0 10px                   | ✅             |
| `.kbd` border         | 1px solid `--line-2` | 1px solid `--mk2-line-2` | ✅             |

### 5. Outer Chassis Grid (`Chassis.svelte` vs `app.jsx::App`)

| Property              | JSX intent         | Svelte port                      | Gap |
| --------------------- | ------------------ | -------------------------------- | --- |
| grid-template-columns | `--rail-w 1fr`     | `--mk2-rail-w 1fr`               | ✅  |
| grid-template-rows    | `--bar-h 1fr 22px` | `--mk2-bar-h 1fr --mk2-status-h` | ✅  |
| height                | 100vh              | 100vh                            | ✅  |

**Structural notes:** Svelte adds defensive `min-height: 0; min-width: 0` to flex items — improvement.

---

## DRAWER CONTENT (6)

### 6-10. Logs, Captures, WiFi, Bluetooth, UAS tabs

**Status: ✅ near-identical to JSX.** All five tabs correctly mirror the JSX mocks: same row data, same grid layouts, same color coding (INFO/WARN/ERROR for logs; RSSI accent threshold for WiFi/UAS), same column orders. One minor: UAS header gap is 12px in Svelte vs 16px in JSX.

**Real-API wiring still TODO** — all tabs render hardcoded mock data, scheduled for PR5+ per CLAUDE.md spec-024 progression.

### 11. Terminal Tab (`TerminalTab.svelte`)

**Status: ⚠️ degraded in production.**

- JSX `DrawerTerminal()` shows tmux winbar, session picker (state dots active/paused/idle/dead), example output (airodump-ng sweep), tab strip `0: claude  1: logs  2: htop  3: repl`, DETACH button.
- Svelte port: HEAD-probes `/terminal-ws` on mount → renders empty state ("Terminal not available in production build") because `vite-plugin-terminal` is dev-only.

**Gap:** the entire tmux session UI from the screenshot doesn't render in production. Either port the WS handler out of `vite-plugin-terminal` (~200 LOC, separate scope) or add a production-safe mock UI matching the JSX.

---

## TOOLS FLYOUT (1)

### 12. Tools Flyout (`ToolsFlyout.svelte` vs `tools-flyout.jsx`)

**Status: 🟡 ~50% complete (RTFM 2026-04-28 02:58 expanded scope).**

Initial Phase 1 audit framed this as "80% complete, 3 missing pieces". A direct read of the JSX prototype's 431 lines (`/tmp/argos-design-ref/src/tools-flyout.jsx`) shows the gap is meaningfully larger — pillar layout, hierarchical tree, schema, and a separate user-manual modal are all part of the JSX intent. See `/tmp/phase3-pr-b-scope.md` for the proposed B1/B2/B3 split.

| Property                                                                                    | JSX intent                 | Svelte port                 | Gap               |
| ------------------------------------------------------------------------------------------- | -------------------------- | --------------------------- | ----------------- |
| Header text                                                                                 | `TOOLS  97 TOTAL`          | `TOOLS · LIBRARY`           | wrong copy        |
| 3 vertical pillars (OFFNET / ONNET / OSINT)                                                 | yes                        | yes                         | ✅                |
| Per-pillar count badges                                                                     | per-pillar count           | derived from `items.length` | ✅                |
| Live search                                                                                 | filter by name+description | identical                   | ✅                |
| Keyboard nav (↑↓ Enter Esc)                                                                 | yes                        | Tab/Esc; no ↑↓              | partial           |
| **Right detail pane** (selected tool: name, description, OPEN VIEW / MANUAL / DOCS buttons) | **yes**                    | **MISSING**                 | ❌ structural gap |
| **Bottom keybind footer** (`↑↓ NAVIGATE  ⏎ OPEN  ESC CLOSE`)                                | **yes**                    | **MISSING**                 | ❌                |

**This is the surface the user explicitly flagged as "NOT the same".** Audit confirms — it's missing the right detail pane and keybind footer. Header copy also differs.

---

## SCREENS (7)

| #   | Screen       | JSX file                                               | Svelte file                        | Status             | Completeness              |
| --- | ------------ | ------------------------------------------------------ | ---------------------------------- | ------------------ | ------------------------- |
| 13  | **OVERVIEW** | `screen-command.jsx`                                   | `OverviewScreen.svelte`            | ✅ Live            | 100% — PR5/6 merged       |
| 14  | **MAP**      | (implicit in screen-command)                           | `MapScreen.svelte`                 | ✅ Live            | 100% — PR6 merged         |
| 15  | **AGENTS**   | `screen-agents.jsx` (most complex JSX, 25KB)           | placeholder only                   | ❌ **NOT PORTED**  | 0% — PR7 in spike phase   |
| 16  | **SPECTRUM** | `screen-spectrum.jsx` (4-panel split: CTL/SPC/WTF/MRK) | `ScreenSpectrum.svelte` shell      | 🟡 Structure ready | 60% — data wiring pending |
| 17  | **KISMET**   | `screen-kismet.jsx`                                    | `ScreenKismet.svelte`              | ✅ Live            | 100% — PR10a merged       |
| 18  | **GSM-EVIL** | `screen-gsm.jsx` (5-panel: CTL/MTR/IMS/INS/CON)        | `ScreenGsm.svelte` (3 of 5 panels) | 🟡 Console missing | 70%                       |
| 19  | **SYSTEMS**  | `systems-overview.jsx`                                 | `SystemsScreen.svelte`             | ✅ Live            | 100% — PR4 merged         |

### Screen-specific gaps

**OVERVIEW:** Theme tokens use `--card`/`--border` in some sub-components instead of `--mk2-bg-2`/`--mk2-line` (mixing legacy Lunaris tokens with mk2). Functional, cosmetically off.

**MAP:** Live; not deeply audited this round (PR6 acceptance gate already passed).

**AGENTS:** Currently shows "SPEC-024 · PR7 — AGENTS · default state" placeholder. JSX prototype has full CTL bar (5 metrics), TMUX session table (9 rows), Workflows panel (13 workflows × 6 categories). All 3 panels need building.

**SPECTRUM:** Component shells exist (`Spectrum.svelte`, `Waterfall.svelte`, `SpectrumControls.svelte`). Backend data wiring is pending — peak-hold + waterfall need real HackRF/B206 sweep data. (We just verified the producer side works on both SDRs in this session.)

**GSM-EVIL:** 3 of 5 panels present (FrequencyTuner, ImsiTable, GsmInspector). Missing: collection-metrics tile (CTL-01/MTR-02 area) and live console feed (CON-05). grgsm_livemon integration pending.

---

## TOKEN FIX MATRIX (the high-leverage one-touch repair)

`src/app.css` `[data-ui="mk2"]` block changes:

```css
/* before */
--mk2-fs-1: 9px;     →  10.5px   (rail-num)
--mk2-fs-2: 10px;    →  10.5px   (drawer tabs, statusbar, panel labels)
--mk2-fs-3: 11px;    →  11px     (already correct, but topbar uses fs-3 currently)

/* font family — Geist Mono must be installed FIRST */
--mk2-f-mono: 'Fira Code', ui-monospace, 'Geist Mono', SFMono-Regular, Menlo, monospace;
                                            ↓
--mk2-f-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
```

**Pre-requisite for the font change:** Install Geist Mono woff2 files into `static/fonts/geist/` (Regular 400, Medium 500, SemiBold 600) and add 3 `@font-face` rules to `static/fonts/geist.css`. Source: `vercel/geist-font` repo, `fonts/GeistMono/webfonts/`.

---

## RECOMMENDED FIX ORDER (Phase 2 + Phase 3)

### Phase 2 — Token + font (small, high-leverage)

1. Download Geist Mono Regular/Medium/SemiBold woff2 from `vercel/geist-font`
2. Place in `static/fonts/geist/`
3. Extend `static/fonts/geist.css` with 3 new `@font-face` rules
4. Update `src/app.css` `[data-ui="mk2"]` block:
    - `--mk2-fs-1: 10.5px`
    - `--mk2-fs-2: 10.5px`
    - `--mk2-f-mono: 'Geist Mono', ...` (Geist Mono first)
5. Verify in chrome-devtools that bottom tabs now render Geist Mono 10.5 px
6. Spot-check topbar, statusbar, left rail — should all shift to design intent simultaneously

### Phase 3 — Per-surface fix PRs (one PR per area, ordered)

**PR A — chassis cleanup** — rail font-size, statusbar exact font-size, topbar font precedence (likely already covered by Phase 2 token fix; verify and close)

**PR B — Tools Flyout completion** — add right detail pane, add keybind footer, fix header copy `TOOLS · LIBRARY → TOOLS  ${total} TOTAL`, add ↑↓ keyboard nav

**PR C — AGENTS screen** — full implementation of CTL bar + TMUX session table + Workflows panel. Largest single piece of remaining work (matches spec-024 PR7 scope, "spike-first").

**PR D — SPECTRUM data wiring** — connect `ScreenSpectrum.svelte` to the c2_scan + b205_spectrum producer pipelines (we just got both working this session)

**PR E — GSM-EVIL console panel** — add `GsmConsole.svelte`, wire grgsm_livemon SSE feed

**PR F — Theme token cleanup** — sweep OVERVIEW for `--card`/`--border` usage, replace with `--mk2-bg-2`/`--mk2-line` for consistency

**PR G — Terminal tab production parity** — port `vite-plugin-terminal`'s WS handler out of vite-plugin into SvelteKit `hooks.server.ts` so production renders the tmux UI from the screenshot

### Phase 4 — Final visual diff

Per surface, chrome-devtools side-by-side with JSX prototype as ground truth. Sign-off: every Mk II screen visually matches the zip.

---

## What was verified working today (out of audit scope, win column)

- **B206mini at SuperSpeed** via direct UHD 4.10 (bypasses gr-osmosdr libuhd-4.1 binding)
- **HackRF firmware updated** to v2026.01.3 (built from source, hackrf_spiflash flashed, verified)
- **c2_scan dual-backend** (HackRF + B206 both produce identical alerts)
- **26 scan centers** across 8 bands (P1+P2+P3 covered)
- **DragonSync ZMQ pipeline** alive and ingesting (verified via /api/dragonsync/c2 200 + Argos UAS pipeline)

These are the producer-side foundations Spectrum / UAS / Kismet screens will consume once their data wiring lands in Phase 3.
