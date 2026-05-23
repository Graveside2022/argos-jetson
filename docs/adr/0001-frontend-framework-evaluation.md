# ADR 0001 — Frontend framework evaluation: is SvelteKit the best long-term framework for Argos?

> Status: **FINAL** — 2026-05-22. Author: framework-fit research (codegraph + semble + dependency inventory + 3 parallel first-party-doc agents).
> Recommendation: **stay on SvelteKit; re-architect in-place.** Revisit React/Next only as a strategic hiring/ecosystem bet.

## Question
Two linked questions from the product owner:
1. Would a framework rewrite (React the named candidate) deliver large gains in **clean architecture, added functionality, long-term maintainability, and design** — accepting a heavier runtime — **while preserving the existing UI/look/feel and wired functionality**?
2. Broad: **what is the best long-term framework for Argos given how it is designed today?**

Method: real multi-framework comparison grounded in **first-party documentation** (doc cascade: tessl → context7 → official docs) + the actual Argos architecture (codegraph structure, semble smells, dependency inventory). No training-data-only claims.

## Architecture facts (codegraph + git, this session)
- **214 Svelte components, 292 server-side TS modules, 132 API route handlers, 15 page routes, 13031 graph nodes**; 92 Python + 4 C (SDR/sensor native).
- **Custom Node server** (`scripts/ops/prod-server.ts`) wraps SvelteKit adapter-node's `build/handler.js` in a hand-rolled `node:http` server with a raw `upgrade` handler → real-time backbone lives **outside** the framework.
- **Real-time-first**: `ws` (`WebSocketServer({ noServer: true })` + manual `upgrade`), SSE streamers, `WebSocketManager`, custom auth (session-token/API-key). Single NVIDIA Jetson **ARM** host, adapter-node (not edge/serverless). Dual UI (:5173/:5174) split server-side by `PORT`.

## Architecture-quality assessment — the pivotal finding
**The architecture pain is discipline-rooted, not framework-rooted.**
- **Server layer (292 TS) is reasonably modular** — service modules (bluedragon `RuntimeState`, mission-store, reports) have clean boundaries.
- **Client smell = fragmented state model**: legacy Svelte `writable` stores (`sources/tmux/workflows/dashboard-store`) coexist with Svelte 5 rune stores (`missions.svelte.ts`, `theme-store.svelte.ts`) and heavy component-local `$state` (TopStatusBar 15+), plus `'mock'` placeholder data sources. This is **migration debt** (Svelte 4→5 half-done), **fixable in-place** by finishing the runes migration + consolidating state ownership — a rewrite is not required to fix it.
- `DashboardShell` is thin (snippet composition); the "monolith" is distributed across panels/views + scattered state, again a refactor target independent of framework.

> Implication: a framework rewrite would force re-architecture, but **the same architectural cleanliness is achievable in SvelteKit at a fraction of the cost.** A rewrite only "wins" where the gain is genuinely framework-inherent.

## Preservation map (what a rewrite keeps vs rebuilds)
| Survives a rewrite (framework-agnostic) | Rebuilt (Svelte-locked) |
|---|---|
| 292 server TS modules' logic, 132 API-route logic | 214 components (markup + reactivity) |
| WS/SSE/`ws`-upgrade backbone, `WebSocketManager`, custom http server | Runes reactivity → target framework's model |
| Custom auth, better-sqlite3 layer | 140 files using `carbon-components-svelte` → target Carbon binding |
| Integration libs: maplibre-gl, cytoscape, xterm, noVNC, mgrs, mil-sym, zod, `ws` (all framework-agnostic) | Svelte wrappers: `svelte-maplibre-gl` → raw maplibre; `@lucide/svelte` → lucide-* |
| 14 Svelte-specific deps are the only hard framework lock-in |  |

The hard real-time parts are **portable**; the rewrite cost+risk concentrates in **214 components + Carbon rebinding**.

## Rubric (weighted for the product owner's priorities: architecture/maintainability/design lead; runtime perf secondary-but-real)
1. Clean architecture / separation of concerns — HIGH
2. Long-term maintainability (ecosystem, hiring, testing) — HIGH
3. Added functionality headroom (component/data/state ecosystem) — HIGH
4. Design-system maturity preserving look/feel (Carbon binding) — HIGH
5. Migration cost + preservation fidelity — HIGH
6. Custom Node server + raw WS/SSE ergonomics — MED (must not regress)
7. Load-time / hydration model on ARM — MED
8. Framework longevity / ecosystem trajectory — HIGH

## Candidate scorecards (first-party-doc-grounded)

### Astro — POOR fit
- Islands/partial-hydration is its value prop, but **the benefit evaporates for a near-fully-interactive dashboard** (every panel → `client:load`); Astro becomes a thin SSR shell around an SPA with zero perf gain + full migration cost. (docs.astro.build/en/concepts/islands)
- Custom server **works** (middleware mode exports `handler`; you own `http.Server` → attach `ws` upgrade, SSE via default streaming). (astro node adapter docs)
- No Carbon binding (would use `@carbon/web-components` or embedded Svelte islands). Mature, but content-site-oriented.

### Qwik — POOR fit (make-or-break failure)
- Resumability benefit **diminished** when all handlers fire early; non-serializable clients (ws/xterm/maplibre/noVNC) need `noSerialize()` + `useVisibleTask$` re-init = same init cost as hydration. (qwik.dev resumable/state)
- **No official WebSocket support** — Node deploy hands you an Express/Fastify entry; attaching raw `ws` is undocumented/unsupported. SSE works via `getWritableStream()`. (qwik.dev middleware/deployments)
- No Carbon binding; smaller ecosystem (Builder.io-backed).

### Next.js / React + @carbon/react — VIABLE, limited upside, high cost
- **RSC headline benefit (less client JS) does not apply** — a near-fully-interactive dashboard makes every component `'use client'`. React hydration (full VDOM reconciliation + runtime shipped) is **heavier than Svelte's compiled event-binding** → *worsens* the measured ~1.6s hydration cost, not improves it. (nextjs.org server-components; react.dev/hydrateRoot)
- **Custom server is mandatory and penalized**: Argos's `ws` noServer/upgrade has no App-Router equivalent (Route Handlers = HTTP verbs only, no upgrade). Next docs, verbatim: a custom server *"will remove important performance optimizations, like Automatic Static Optimization"* and is **incompatible with `output: 'standalone'`**. SSE works via `ReadableStream`. Deploys fine on a single ARM Node host (no Vercel needed). (nextjs.org custom-server, route reference, deploying)
- **`@carbon/react` is IBM's FLAGSHIP** (v1.108.0, ~weekly cadence, 305 versions) — broader coverage + first to new Carbon components vs the community `carbon-components-svelte` port. Same `@carbon/styles` Sass tokens → **high visual fidelity** preserved. This is the **one genuine framework-inherent gain.** (npmjs @carbon/react; carbondesignsystem.com/developing/frameworks/react)
- State/data ecosystem deep (TanStack Query / Zustand / Redux) but **all live-WS state needs manual bridging** into the query client — arguably more wiring than co-located runes.
- **Largest hiring pool / longest horizon** (Meta + Vercel + IBM backing). Cost: **300–500 files touched, months**; runtime heavier; React v15/16 breaking-change churn.
- Honest framing (agent, cited): "right when you need RSC, Vercel's edge, or a large hiring pool — none of which apply to a single-ARM-host, fully-interactive, real-time sensor dashboard already running well on SvelteKit."
### Solid / SolidStart — POOR fit (make-or-break failure)
- Best-in-class reactivity (fine-grained signals, no VDOM) — theoretically ideal for a live dashboard.
- **WS BLOCKED**: SolidStart's server is **Nitro/Vinxi**, which owns the HTTP server and supports WebSockets only via **CrossWS `defineWebSocketHandler`** — *not* raw `ws` noServer upgrade. No `prod-server.ts`-style http.Server ownership without ejecting Nitro. (nitro.build/guide/websocket; SolidStart WS docs 404 = unstable). **No Carbon binding.** SolidStart 1.0 new, docs incomplete. Very high migration, marginal benefit.

### Vue / Nuxt — POOR fit (make-or-break failure)
- Most mature alt ecosystem (Pinia official, TanStack Vue Query). But **Nuxt = same Nitro block** on raw `ws`; bare-Vue keeps the custom server only by **abandoning the meta-framework** (hand-roll routing/SSR/middleware). Proxy + compiler-informed **VDOM hydration is heavier** than Svelte 5 compiled output. **No maintained Vue-3 Carbon binding** (`carbon-components-vue` is Vue-2, unmaintained). Max migration cost, ~zero architectural benefit. (vuejs.org/guide/scaling-up/ssr; nuxt.com server-engine)

### SvelteKit / Svelte 5 (incumbent baseline — anchor) — BEST fit
- Compiled, no-VDOM, fine-grained signal reactivity (runes) — light hydration (signal-init, not VDOM reconciliation).
- **Custom server + raw `ws` noServer upgrade = the live production pattern** (`adapter-node` → `build/handler.js` wrapped in `node:http`; auth via `handle()` hook). Zero migration, no framework surgery. SSE via `ReadableStream`. (kit.svelte.dev/docs/adapter-node — confirmed by Argos's own `prod-server.ts`)
- **First-party Carbon** (`carbon-components-svelte`, in use). The only gaps (islands/resumability) **don't matter** — the LCP bottleneck is service-init/whole-tree hydration on ARM, not framework overhead, and no mainstream framework fixes that without an island model wasted on a fully-interactive UI.
- Smaller ecosystem/hiring pool than React = the one real long-term weakness.

## Scored matrix (1–5, 5 best; ⛔ = gate-fail on the make-or-break custom-server/WS axis)
| Criterion (weight) | SvelteKit (in-place) | Next/React | Astro | Qwik | Solid | Vue/Nuxt |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Clean architecture (H) | 4 | 4 | 3 | 3 | 4 | 4 |
| Maintainability (H) | 4 | 5 | 3 | 2 | 2 | 4 |
| Functionality headroom (H) | 3 | 5 | 3 | 2 | 2 | 4 |
| Carbon design maturity (H) | 5 | 5 | 2 | 1 | 1 | 1 |
| Migration cost / preservation (H) | 5 | 1 | 1 | 1 | 1 | 1 |
| **Custom server + raw WS (GATE)** | **5** | 2 | 4 | **⛔1** | **⛔1** | **⛔1** |
| Load/hydration on ARM (M) | 4 | 2 | 2 | 3 | 5 | 2 |
| Longevity / hiring (H) | 3 | 5 | 4 | 2 | 2 | 4 |

**Gate logic:** the raw-`ws`-noServer-upgrade + custom-`prod-server.ts` requirement is a hard gate, not a weighted line. Qwik (no official WS), Solid/SolidStart and Vue/Nuxt (Nitro owns the HTTP server, CrossWS-only) **cannot host Argos's transport without abandoning the meta-framework or rewriting all WS handlers** — they are eliminated regardless of other scores. Astro passes the gate but its islands value is void on a fully-interactive UI. Only **SvelteKit** (pass, zero cost) and **Next/React** (pass, but penalized custom-server + heavy migration) remain real.

## Verdict

**Best long-term framework for Argos as designed today: stay on SvelteKit / Svelte 5.** No framework beats it on Argos's actual profile (real-time-first + custom Node server + raw `ws` + single ARM host + near-fully-interactive UI + first-party Carbon), and three popular alternatives (Qwik, Solid, Nuxt) gate-fail on the WebSocket transport.

**On the owner's core thesis ("React heavier but GAIN more from a rewrite"):** the gains the owner wants — clean architecture, maintainability, design — are **mostly discipline-rooted, not framework-rooted**, and reachable in-place:
- Finish the **Svelte 4→5 migration**: retire legacy `writable` stores (`sources/tmux/workflows/dashboard-store`) in favor of rune modules (the `missions.svelte.ts` pattern), consolidating to one state model.
- Remove `'mock'` placeholder data sources; establish clear state ownership (lift component-local `$state` clusters like TopStatusBar's into cohesive stores where shared).
- Decompose the distributed dashboard monolith along the existing snippet/island boundaries.
This buys ~80% of the "clean architecture" win for a fraction of a rewrite's cost, with **zero runtime regression and zero risk to the working real-time/hardware backbone**.

**The genuine, framework-inherent gains a React rewrite WOULD deliver** (be honest): `@carbon/react` is IBM's flagship Carbon (broader/fresher than the community Svelte port), the **hiring pool and component/data ecosystem are far larger**, and React's patterns are more widely documented. These are real — but they are **strategic/organizational** advantages, not fixes to a technical deficiency in the current stack. They cost **300–500 files rewritten over months, a heavier runtime** (RSC's JS-reduction is void on a fully-interactive dashboard; React hydration is heavier than Svelte's compiled output → *worsens* the measured LCP), and a **penalized custom-server path** (loses Automatic Static Optimization, incompatible with `output: 'standalone'`).

**The decision therefore hinges on a business priority, not a technical one** — surfaced for the owner's call:
- **Prioritize velocity, runtime, and preserving a working system →** stay SvelteKit + in-place re-architecture. (Recommended.)
- **Prioritize hiring/ecosystem depth + `@carbon/react` flagship as a multi-year strategic bet, accepting months of rewrite + heavier runtime →** Next/React is the only viable migration target (and only it; not Astro/Qwik/Solid/Vue).

**What to preserve regardless of choice** (the portable backbone — see preservation map): the 292 server TS modules, 132 API-route logic, WS/SSE/`ws`-upgrade infra, custom auth, better-sqlite3 layer, and integration libs (maplibre/cytoscape/xterm/noVNC/mgrs). A rewrite only touches the 214 components + Carbon rebinding + reactivity model.

## Recommendation
**Stay on SvelteKit; invest the rewrite-equivalent effort into in-place re-architecture** (state-model consolidation + monolith decomposition). Revisit React/Next only if hiring/ecosystem depth becomes a board-level strategic priority that outweighs the rewrite cost — at which point React (with `@carbon/react`) is the sole sensible target, and the portable backbone makes the migration bounded.

> Status: **FINAL** — 2026-05-22. Every framework capability claim cited to first-party docs (context7 / official docs, via 3 parallel research agents); architecture claims cited to codegraph + dependency inventory.
