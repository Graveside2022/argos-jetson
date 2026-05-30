# ADR 0006 — Adopt IBM Carbon Design System as the sole UI standard

> Status: **ACCEPTED** — 2026-05-29. **Supersedes the design-system stance of ADR 0001 and ADR 0002** (which treated Carbon as legacy to be removed and "Lunaris" as the forward system). The SvelteKit + Svelte 5 framework decisions in 0001/0002 still stand — only the design-system direction reverses.
> Grounded in: the 2026-05-29 Carbon compliance audit (`docs/audit/2026-05-29-carbon-compliance-audit.md`) and the `--cds-*` token facts verified verbatim from the installed `carbon-components-svelte@0.107.0`.

## Context

Prior records (ADR 0001 FINAL, ADR 0002; spec arc 017–026 "Lunaris") set the UI direction _away_ from IBM Carbon toward a custom design system ("Lunaris"): an `app.css :root` block of hex tokens plus 13 `[data-palette]` MIL-STD theme blocks, with a parallel orphaned `--mk2-*` (Mk II) token family. Carbon was retained only as an islanded legacy layer.

The 2026-05-29 audit of all 144 Svelte components found:

- **~34% mean / 18% median** Carbon compliance; 105/144 use zero Carbon components.
- **`--cds-*` tokens were not even exposed**: the root layout imported `carbon-components-svelte/css/g100.css`, which bakes literal hex and exposes ~2 custom props. Only `all.css` exposes the 457 `--cds-*` properties.
- **803 Lunaris token references, 292 hardcoded colors, 40 orphaned `--mk2-*` references** (the last are a live styling bug — undefined since #227).

Decision driver: IBM Carbon is an industrial-grade, accessible, themeable design system appropriate for a tactical SDR/EW console. The owner has directed **full Carbon adoption with zero exceptions**.

## Decision

**IBM Carbon (via `carbon-components-svelte`) is the SOLE UI design system for Argos.** Every UI element, CSS rule, and design token must be Carbon-compliant:

- **Components**: use `carbon-components-svelte` components (Button, DataTable, TextInput, Dropdown, Tabs, Tile, InlineNotification, Tag, …) — no hand-rolled equivalents, no shadcn-svelte primitives.
- **Tokens**: color/type/spacing via `--cds-*` only — no Lunaris tokens (`--foreground`, `--primary`, `--card`, `--border`, `--text-*`, …), no `--mk2-*`, no hardcoded hex/rgb.
- **Type**: IBM Plex (Sans + Mono) via Carbon type tokens (`--cds-<token>-{font-size,font-weight,line-height,letter-spacing}`). IBM Plex is accepted (replaces Geist/Fira).
- **Theme**: `all.css` + `theme="g100"` (dark) on `<html>`.
- **A11y**: Carbon accessibility patterns.

No Lunaris, no custom CSS token system, no shadcn — Carbon the whole way.

### End state

**Pure Svelte + IBM Carbon Svelte. Every one of the 144 UI components touched exactly once and converted to: carbon-components-svelte components + carbon-icons-svelte + scoped Svelte `<style>` consuming `--cds-*` tokens + Carbon spacing/type. No Tailwind, no Lunaris token layer, no shadcn `ui/*`, no Geist/Fira.** Tailwind utility classes are removed _as part of each component's single migration pass_ (not bridged) — so no component is touched twice and no throwaway glue is maintained.

### Migration (phased, atomic commits, phased PRs into `dev`, verify after each)

- **P1 — expose tokens (DONE, PR #281):** root import `g100.css` → `all.css`; `theme="g100"` on `<html>`. Makes the 457 `--cds-*` tokens resolve app-wide. `carbon-preprocess-svelte` (`optimizeImports`) already wired. e2e-verified (chrome-devtools/Sentry/otel).
- **~~P2 — token bridge~~ — DROPPED.** Rationale: a bridge (redefining Lunaris `:root` vars as `var(--cds-*)`) exists only to avoid editing components. Since the decision is to touch every component once anyway, the bridge is pure throwaway — and Tailwind v4's `@theme` build-time color resolution makes it fragile (see `docs/reference/tailwind-svelte-setup.md` §4). The existing Lunaris `:root` + Tailwind `@theme` are left **untouched** so un-migrated components keep rendering during the migration; each component drops them when it is migrated.
- **P-MIGRATE — per-component conversion (the bulk):** convert all 144 components, batched into phased PRs by area (chassis → `ui/*` primitives → dashboard → map → gsm-evil → routes). Highest-leverage first: the shadcn `ui/*` primitives (button/badge/input/table) and the most-used Carbon components (Button → DataTable → Tag → InlineNotification → inputs → Tabs → Tile). Add `carbon-icons-svelte` (icons), `@carbon/charts-svelte` (`--signal-*`/`--chart-*` data-viz). Each component PR: Carbon components + scoped `var(--cds-*)` styles + Carbon icons, removing that component's Tailwind classes + Lunaris vars + shadcn usage in the same pass. Build + e2e verify each.
- **P-PALETTES — 13 MIL-STD palettes:** re-express the `[data-palette]` overrides as Carbon brand/interactive/link/focus token overrides (no Lunaris). Do once the token consumers are Carbon.
- **P-CLEANUP — remove Tailwind + Lunaris + shadcn (final):** once all 144 are migrated — delete `@tailwindcss/vite` + the `@theme` block + Tailwind deps, the Lunaris `:root` token layer, the shadcn `ui/*` primitives, and the Geist/Fira font links. Re-run the 144-component compliance audit → target ~100%. This is the gate that proves "zero non-Carbon."

## Consequences

**Positive:** one industrial-grade, accessible, consistent design system; built-in theming; removes two parallel custom token vocabularies and the orphaned `--mk2-*` bug.

**Negative / accepted:**

- Multi-week effort; reverses the documented Lunaris direction (specs 017–026).
- The 13 MIL-STD palettes must be rebuilt on Carbon brand tokens (Carbon has no native "swap one accent across N palettes").
- `carbon-components-svelte` components emit events via the Svelte 4 `createEventDispatcher` / `on:eventname` idiom (NOT Svelte 5 callback props; not authored in runes). Verified 2026-05-29 via context7 + octocode + context-mode (unanimous): 58 `createEventDispatcher` uses in `src`, 0 callback props; latest published `0.107.1`, installed `0.107.0` — same era, no API change. **No Svelte-5-callback-prop-native version exists or is on the roadmap** (new dispatch-based components still shipping, e.g. RangeSlider PR #3095, 2026-05-28). **This is a non-issue for P4 — NO shim required:** Svelte 5 retains backward-compat for `on:`/`createEventDispatcher`, so dispatch-based Carbon components work as-is inside Svelte 5 runes app code (the lib declares no `peerDependencies`, installs cleanly beside Svelte 5). **P4 decision:** accept dispatch interop; bump to `0.107.1`; author Argos app/wrapper code in runes (`$props`/`$state`); consume Carbon events via `on:eventname`; optionally wrap heavy-use components in thin runes adapters (style preference, not correctness).
- IBM Plex replaces Geist/Fira (visible typeface change; accepted).

**Process:** atomic small commits; phased PRs to `dev`; per-step verification via `npm run check`/`verify`, `rtk`/`codegraph`/`semble`/`svelte` MCP for audit, and `chrome-devtools` + Sentry + OpenTelemetry/Jaeger for e2e/runtime checks.
