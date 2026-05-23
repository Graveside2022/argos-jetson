# ADR 0002 — Doc-grounded Svelte refactor roadmap (fix the discipline debt)

> Status: **PROPOSED** — 2026-05-22. Follows ADR-0001 (stay on SvelteKit, re-architect in-place).
> Goal: bring the codebase to **official Svelte 5 best-practices**, measured against first-party docs + the official Svelte skills — not vibes.

## Context
ADR-0001 concluded Argos should stay on SvelteKit and invest rewrite-equivalent effort into **in-place re-architecture**. This roadmap is that work. The pain is *discipline/migration debt*, not framework limitation: the Svelte 4→5 migration is **mostly done but uneven**, state management is **split between legacy stores and runes**, and a handful of **god-components** carry too much. We refactor everything that deviates from documented best practice, in priority order, **each change validated by the official Svelte tooling**.

### Authoritative sources (installed/used this session)
- **`svelte-core-bestpractices`** (official, `sveltejs/ai-tools`, installed) — the rubric every rule below cites.
- **`svelte-code-writer`** (official, installed) — `npx @sveltejs/mcp svelte-autofixer` (= the `svelte` MCP `svelte-autofixer`): **run on every refactored component before commit.**
- Official docs (doc cascade): svelte.dev/docs/svelte, svelte.dev/docs/kit, the `svelte` MCP `list-sections`/`get-documentation`, carbon-components-svelte, vite.dev, typescriptlang.org. tessl tiles in sync: `svelte@5.46.1`, `sveltejs--kit@2.49.0`, `vite@7.3.0`.
- Supporting tessl skills (route per phase): `simple-typescript` (`.ts` taste), `web-accessibility-essentials` (a11y), `graceful-degradation` (the 502/MapLibre runtime failures), `abstract-state-analyzer` (the Sentry null-derefs), `realtime-web-patterns` (WS/SSE store→class migrations), `lint-and-validate` (gate).

## Refactor-point map (codegraph + semble + git census + Sentry + chrome-devtools)
Migration is **further along than feared** — these are **0**: `export let`, `$:` reactive statements, `createEventDispatcher`, `<slot>`, `use:action`. Runes are broad (`$props` 128 files, `$state` 61). So the surface is focused:

| # | Class | Scope (measured) | Best-practice rule (svelte-core-bestpractices) | Priority |
|---|---|---|---|---|
| R1 | **Legacy stores → classes-with-`$state` + `createContext`** | **30 files** import `svelte/store` (writable/readable): `dashboard-store`, `gps/kismet/hackrf/gsm-evil` stores, `terminal-store`, `agent-context-store`, etc. | "use classes with `$state` fields to share reactivity between components, instead of using stores"; "use `createContext` … scope state … eliminate leaking between users when SSR" | **HIGH** (architecture) |
| R2 | **`$state` → `$state.raw` for wholesale-replaced data** | API-response state reassigned (not mutated) — e.g. TopStatusBar `pingResults/meshData/weather`, the 30 stores' payloads | "large objects only ever reassigned … use `$state.raw` … often the case with API responses" | **HIGH** (perf-correct) |
| R3 | **`on:event=` → `onclick={}`** ⛔ **BLOCKED by Carbon** | **20 files / 34 hits — ALL consume `carbon-components-svelte` components' `createEventDispatcher` events** (verified: Carbon 0.107 dispatch-based across 57 files; `IconBtn` `on:click` is on `<Button>`, not native). Carbon exposes NO callback props → `on:` is REQUIRED to receive them; converting breaks all events. | Svelte legacy-on: consume `createEventDispatcher` via `on:`; callback props need the CHILD to expose them | **DEFERRED** — documented exception until carbon-components-svelte ships Svelte-5 callback-prop components (or Carbon is replaced). NOT Argos debt. |
| R4 | **`$effect` audit → `$derived`** | 40 files use `$effect`; semble shows **most are legitimate** (lifecycle cleanup, `$effect.root` persistence). Target only effects that *compute/assign state* | "Effects are an escape hatch … avoid updating state inside effects … use `$derived`" | MED (judgment) |
| R5 | **Decomposition: ALL 40 monoliths >300 LOC** (19 UI `.svelte` + **21 server `.ts`**, per user — full hygiene) | UI: ReportsView 919, BluetoothPanel 684, DashboardMap 510 … (19). Server: streaming-inspector 482, rf-visualization 462, database 406, hooks.server 347, websocket/base 305 … (21). Excl: data-catalog 1008 + tests. Long-by-size, not complex (all CC≤5). | snippets/`{@render}`; extract modules; keyed `{#each}`; behavior-preserving | MED (auditability) |
| R6 | **`class:` directive → clsx-style arrays** | **147 hits** | "use clsx-style arrays/objects in `class`, instead of the `class:` directive" | LOW (soft/mechanical) |
| R7 | **Runtime null-safety bugs** (Sentry) | ARGOS-4 `undefined.reduce`, ARGOS-3 `undefined.fn` — both `/dashboard` | defensive init via `$state.raw(defaults)`; props→`$derived` | **HIGH** (live bugs) |
| R8 | **Runtime resilience** (chrome console) | 502 Bad Gateway on a proxied endpoint; repeated MapLibre map errors | `graceful-degradation`: timeout+fallback+circuit-breaker; surface MapLibre errors to a fallback tile | MED |

## Staged plan (each phase: codegraph blast-radius → edit → `svelte-autofixer` → `npm run verify` → E2E)
**Cross-cutting execution discipline (per `svelte-code-writer` + project rules):**
- Before each store/component change: `codegraph_impact` / `codegraph_callers` for blast-radius; `semble` to find all sibling instances.
- After each `.svelte`/`.svelte.ts` edit: **`svelte-autofixer`** (mandatory), then `npm run verify` (lint + `svelte-check` + audit), then Playwright `dashboard-characterization.spec.ts` 5/5 + visual check (Jetson Playwright caveats per memory). `:5174` mk2 must stay intact.
- One PR per phase (≤2000 LOC or split), `size-cap-exempt` applied at create-time if needed; sentrux session bracket; skill-receipt in PR body.

- **Phase 0 — Guardrails.** Add an ESLint rule/CI check banning new `svelte/store` imports + `on:` directives (lock the gains). Verify: lint fails on a planted violation.
- **Phase 1 — R7 + R2 (highest ROI, low risk).** Fix the two Sentry null-derefs with defensive `$state.raw(defaults)`; generalize `$state.raw` for API-response state across TopStatusBar + the store payloads slated for R1. Verify: ARGOS-3/4 stop reproducing; `abstract-state-analyzer` on the two culprit functions; autofixer clean.
- **Phase 2 — R1 store→runes/context (the big one), incremental.** Migrate the 30 stores **one cohesive group at a time** (dashboard nav state → map state → device/tactical stores → agent/terminal). Pattern: a `.svelte.ts` class with `$state` fields + `createContext` for scoped consumers; keep the `fromStore()` bridge only during transition. `realtime-web-patterns` for the WS/SSE-backed stores (gps/kismet/hackrf). Verify per group: codegraph callers all updated, autofixer clean, E2E green, no SSR cross-user leak.
- **Phase 3 — R3 event directives + R4 effect audit.** Mechanical `on:`→`onclick` (20 files); then review the `$effect`-computes-state cases → `$derived`/`$derived.by`. Verify: `$inspect.trace` on any reactivity that changes; autofixer.
- **Phase 4 — R5 decomposition.** Split the 8 god-components along snippet/section seams (ReportsView/BluetoothPanel/DashboardMap first). `simple-typescript` + `web-accessibility-essentials` (these carry forms/tables/live regions). Verify: behavior parity via E2E + visual snapshot.
- **Phase 5 — R8 resilience + R6 class: cleanup (lowest priority).** `graceful-degradation` on the 502 endpoint + MapLibre error fallback; `class:`→clsx where it improves clarity (not blanket churn).

## Verification (definition of done)
- Every refactored `.svelte`/`.svelte.ts` passes **`svelte-autofixer`** with no findings, `svelte-check` 0 errors, `npm run verify` green.
- Census re-run shows the targeted class trending to 0 (stores, `on:`); guardrail lint prevents regressions.
- Sentry ARGOS-3/4 resolved; chrome console 502 + MapLibre errors handled (graceful fallback, no uncaught).
- Playwright `dashboard-characterization.spec.ts` 5/5 each phase; `:5173` and `:5174` both intact.
- `sentrux scan` structural grades flat-or-better before→after each PR.

## Out of scope
- Framework switch (ADR-0001: no). LCP hydration floor (ADR plan: hardware-bound, separate).
- Blanket `class:`→clsx churn (only where it clarifies).
- The Svelte-4 patterns already at 0 (no work needed).
