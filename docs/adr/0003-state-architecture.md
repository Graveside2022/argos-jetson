# ADR 0003 — State-management architecture (the professional target for the store refactor)

> Status: **ACCEPTED** — 2026-05-22. Supersedes the ad-hoc per-store decisions in the Phase-3 plan (incl. the earlier "keep persisted-writable as infra" call, which this investigation overturns).
> Grounded in: official Svelte 5 docs (`kit/state-management`, `svelte/stores`, `svelte/context`, `svelte/svelte-js-files`) + codegraph/grep inventory of the actual codebase.

## Problem
Argos's state layer is **mid-migration and split across two paradigms**, which is the real architectural debt behind the "monolithic / undisciplined" concern:
- `src/lib/state/` — **11 modern rune `.svelte.ts` modules** (chassis, detections, events, gsm, kismet, map-overlay, missions, spectrum, systems, ui, +helpers). The intended target pattern.
- `src/lib/stores/` — **24 legacy `svelte/store` files** (the backlog). 29 files repo-wide still import `svelte/store`; 19 `.svelte.ts` rune modules already exist (~40% migrated).

Two coexisting paradigms = two mental models, inconsistent consumer APIs (`$store` vs `.field`), and no single persistence story. A professional program needs **one** state architecture.

## What the official Svelte 5 docs mandate
1. **Runes replace stores for shared state.** `.svelte.js/.svelte.ts` modules are the canonical home for shared reactive state/logic.
2. **Stores remain justified ONLY for "complex asynchronous data streams" or RxJS interop / manual subscription control** (verbatim: *"Stores are still a good solution when you have complex asynchronous data streams or it's important to have more manual control over updating values or listening to changes."*).
3. **Module-singleton `$state` is safe WITHOUT context when there is no SSR** (verbatim: *"If you're not using SSR (and can guarantee that you won't need to use SSR in future) then you can safely keep state in a shared module, without using the context API."*). Context is only needed to prevent cross-user SSR leakage.
4. **localStorage persistence = "write your own logic to sync"** on a rune — i.e. a small rune `persistedState` primitive is the sanctioned pattern.

## Decisive Argos fact
**The dashboard is `ssr = false, csr = true`** (confirmed: `src/routes/dashboard/+page.ts` and `dashboard/mk2/+page.ts`). → **module-singleton rune state is correct and safe; `createContext` is NOT required.** This removes the only objection to the existing singleton-factory pattern (`theme-store`, `missions`, and my migrated `workflows`/`sources`/`tak`/`map-settings`).

## Target architecture (professional end-state)
1. **One state layer, rune-based.** Consolidate `src/lib/stores/*` onto the `src/lib/state/` rune `.svelte.ts` pattern (singleton factory returning getters + methods; `$state.raw` for wholesale-replaced API data). Module singletons are sanctioned (no SSR).
2. **One persistence primitive.** Promote `lsState` (`state/ui.svelte.ts`) into a full **`persistedState<T>(key, default, { serialize?, deserialize?, schema?, validate? })`** rune with **feature parity to `persistedWritable`** (the load/save/serde/Zod helpers port verbatim). Then migrate the 5 persisted stores + the 7 `persistedWritable` consumers onto it and **delete `persisted-writable.ts`** (resolving the earlier "keep" question — migrate, don't keep).
3. **Stores retained ONLY where the docs justify them** — genuinely complex async streams. Candidates to *evaluate* (not auto-migrate): WS/SSE-fed `gps-store`, `kismet-store` (real-time device streams with Map state + service-driven updates). Either migrate to runes via `createSubscriber`/service-writes-`$state`, OR keep as `svelte/store` with a documented "complex-async-stream" rationale. Decide per-store on its async complexity, not blanket.
4. **Boundaries unchanged.** `eslint-plugin-boundaries` already enforces state↛server / state↛component; the rune modules live in the same `state` layer and keep those rules.

## Migration strategy (phased, verify-first — each its own gated PR)
- **Done:** workflows, sources, tak, map-settings → rune singletons (gated, tested). hackrf dead-chain removed; duplicate SSE deduped.
- **Next — pure-writable stores:** agent-context, uas, gsm-evil, globalprotect, tmux → rune singletons (tmux/globalprotect carry polling — lifecycle care).
- **Foundation — `persistedState` primitive + persisted stores:** build the rune primitive (parity-tested), then migrate tools / rf-overlay / rf-propagation / dashboard-store / terminal + the 7 consumers + the downstream `$store` readers (cascade measured: `$activeView` ~25 files, ~15 distinct files total — mechanical `$x`→`x.current`). Delete `persisted-writable.ts`.
- **Complex-async tier — decide-then-act:** gps, kismet, bluetooth (Map state, WS/SSE) — apply the docs' "complex async stream" test; migrate with `SvelteMap`/`createSubscriber` or document the store carve-out.
- Per change: codegraph impact + semble sibling-find → migrate → `svelte-autofixer` → unit test → `eslint .` 0 errors (CC≤5) → `svelte-check` 0 → Playwright on the affected route; `:5173` + `:5174` intact.

## Verification / DoD
- `svelte/store` imports trend to **0 except documented complex-async carve-outs**; one rune persistence primitive; `persisted-writable.ts` deleted.
- All state in `src/lib/state/` (or co-located `.svelte.ts`); consistent getter/method API; no `$store` cross-API inconsistency.
- Gates green every PR (autofixer/test/eslint-0/svelte-check-0); `sentrux` coupling/cohesion grade improves.

## Honest note on the reversal
The earlier "keep persisted-writable as infrastructure" call was over-conservative — driven by `lsState`'s current feature gap, not the architecture. The deep investigation (docs + the existing `state/` rune layer + `ssr=false`) shows the professional answer is to **build the rune `persistedState` primitive and migrate** — it unifies the two state layers, which is the actual fix for the "undisciplined" concern. The cost is a measured, mechanical cascade, not a technical risk.
