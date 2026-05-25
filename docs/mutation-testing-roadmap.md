# Mutation Testing Roadmap — risk-first, layered defense

**Goal:** stryker-verified mutation score ≥ 80% on **critical-path files
only** (~50-80 files). For non-critical code, rely on the existing layered
defense stack (TS strict, ESLint, Sentrux, ArchUnitTS, CodeQL, Playwright
visual regression, Sentry) rather than expensive mutation testing.

**Revised:** 2026-05-25 (Phase 2 pivot — original "all 4034 files in 14-23
weeks" scope was overreach; replaced with risk-ordered critical-paths-only
scope).

**Original aspirational scope:** 4034 source files, 14-23 weeks. Replaced
after Phase 1 evidence showed mutation testing's real value is on
security/correctness-critical code, not pure utilities or UI.

## Strategy

**Mutation testing is one tool, not the only tool.** It excels at measuring
oracle strength on critical code. For non-critical code, the existing
layered defense catches the same issues cheaper.

Phase by **risk** (severity of bugs the layer could ship), not by directory
walking. Each phase = 1 PR per sub-module at ≥80% mutation score.

## Layered defense — what catches what

| Layer                                                                        | Catches                                 | Cost                     | Status                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------- | ------------------------ | --------------------------------------------------------------- |
| **TypeScript strict** + `tsc --noEmit`                                       | type errors, missing fields, null deref | free                     | ✅ already on                                                   |
| **ESLint** (incl. `@typescript-eslint/*`, `boundaries`, `sonarjs`, `svelte`) | bug patterns, style, layer violations   | free                     | ✅ already on                                                   |
| **Sentrux** (project ruleset)                                                | architectural drift, structural quality | session-bracketed        | ✅ already on                                                   |
| **ArchUnitTS** (`tests/architecture/`)                                       | layer-ordering, network boundary        | CI-gated                 | ✅ in CI as of PR #241                                          |
| **CodeQL** (default + custom queries)                                        | security/correctness via dataflow       | free on GitHub           | ✅ already on                                                   |
| **Playwright visual regression** (`tests/visual/`)                           | UI rendering bugs                       | minutes                  | ✅ already on                                                   |
| **Sentry** runtime monitoring                                                | bugs that escaped tests, in prod        | already paid             | ✅ already on                                                   |
| **vitest unit/integration**                                                  | per-function behavior                   | seconds-minutes          | ✅ already on                                                   |
| **vitest --coverage**                                                        | untested code (zero-coverage files)     | seconds                  | ✅ underused — surface untested critical files this way FIRST   |
| **fast-check** (property-based)                                              | edge cases tests forget                 | seconds                  | ✅ installed, underused — apply to Zod schemas + numeric paths  |
| **Stryker mutation testing**                                                 | weak oracles on tested code             | minutes-hours per module | ✅ NEW — Phase 1+1.5 shipped, critical-paths-only going forward |

## Critical-paths-only scope (~50-80 files)

|                  # | Module                                                       |         Files | Risk if weak tests                                                     | Priority | Status                                       |
| -----------------: | ------------------------------------------------------------ | ------------: | ---------------------------------------------------------------------- | -------- | -------------------------------------------- |
|                  1 | `src/lib/server/api/` (utility layer)                        |             5 | Request-handling exceptions, error envelope shape                      | HIGH     | ✅ done (PR #241) — 97.37%                   |
|                  2 | `src/lib/server/middleware/` (auth, CSRF, security-headers)  |             4 | **CRITICAL** — unauthorized access, request forgery                    | NEXT     | pending                                      |
|                  3 | `src/lib/server/hardware/` (claim/release, resource-manager) |            18 | **CRITICAL** — race conditions, USB device contention, corrupted state | next-2   | pending                                      |
|                  4 | `src/lib/server/db/` (better-sqlite3, migrations, queries)   |            27 | **HIGH** — data corruption, leak, FK integrity                         | next-3   | pending                                      |
|                  5 | `src/lib/schemas/` (Zod validators)                          |             9 | HIGH — injection, DoS via unvalidated input                            | next-4   | pending; pair with fast-check property tests |
|                  6 | WebSocket message handlers (in `src/lib/server/services/`)   |        ~10-20 | HIGH — sync logic, reconnection state                                  | next-5   | pending                                      |
| **CRITICAL TOTAL** |                                                              | **~75 files** |                                                                        |          | ~1-2 weeks parallelized                      |

## Deferred (rely on layered defense)

| Module                                  |  Files | Why deferred                                                 | Substitute defense                                                                 |
| --------------------------------------- | -----: | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `src/lib/utils/`                        |     21 | Pure helpers, low blast radius (logger msgs, format helpers) | `vitest --coverage` finds zero-coverage; `tsc strict` + `eslint` catch most issues |
| `src/lib/types/`                        |    ~30 | Type-only files, zero runtime to mutate                      | `tsc strict` IS the test                                                           |
| `src/routes/` (Svelte components)       |   ~245 | Visual rendering, UX                                         | `tests/visual/` Playwright regression, `web-accessibility-essentials` skill        |
| `src/lib/components/` (Svelte)          |   ~200 | Same — UI                                                    | Visual regression + ArchUnitTS layer rules                                         |
| `src/lib/stores/`, `src/lib/state/`     |    ~45 | Svelte 5 runes — stryker support experimental                | Manual review + `svelte-best-practices` skill                                      |
| `tactical/blue-dragon/` (Rust crate)    | varies | Wrong language                                               | Use `cargo-mutants` separately if needed (not stryker)                             |
| Generated/vendored code, configs, tests | varies | No source to mutate                                          | N/A                                                                                |

## Method (per critical-path PR)

1. **Coverage gap pass first** — `npm run test:coverage` on the target dir. Identify zero-coverage files. Write minimal tests for those (biggest ROI).
2. **Invoke the matching skill** for the module's domain:
    - middleware → `tessl__software-security` + `tessl__csrf-protection` + `tessl__ssr-auth-session-management`
    - hardware → `tessl__graceful-degradation`
    - db → `tessl__sqlite-node-best-practices`
    - schemas → `tessl__simple-typescript` + fast-check
3. **Update stryker config** mutate scope to ONLY this sub-module.
4. **Baseline `npm run test:mutation`** with parallel config (concurrency:2-4 depending on system load — see config notes).
5. **Triage survivors** per `docs/mutation-baseline-2026-05-25.md` action table.
6. **Write tests / annotate equivalents** until ≥80%.
7. **Re-run stryker** → verified score.
8. **Ship PR** with: tests + this roadmap doc updated with row status + survivor triage doc.

## Parallel-run config

Stryker config now ships with `concurrency: 4` (lifted from RPi5-era `1`).
Vitest stryker config has `maxWorkers: 2`. Effective: 8 active workers on
8-core Jetson (full utilization, no oversubscription).

**Caveat:** when other CPU-heavy work runs on the box (Argos services,
chromium-mcp, claude-mem, parallel Claude sessions), dial back to
`concurrency: 2` to leave headroom. The 8-core full-utilization assumes
mutation testing is the only heavy workload.

For multi-module parallel runs: spawn N stryker bg jobs each at
`--concurrency $((8/N))` so the sum stays at 8 cores.

## Estimated effort (revised)

| Module                |                  Est PRs |                       Est wall time (parallel) |
| --------------------- | -----------------------: | ---------------------------------------------: |
| 1. api utility (done) |                     done |                                           done |
| 2. middleware         |                        1 |                   ~15-30 min stryker + writing |
| 3. hardware           |                      1-2 |                   ~45-90 min stryker + writing |
| 4. db                 |                      1-2 |                  ~60-120 min stryker + writing |
| 5. schemas            | 1 (paired w/ fast-check) |                                     ~30-60 min |
| 6. WebSocket handlers |                        1 |                                     ~30-60 min |
| **TOTAL**             |              **5-7 PRs** | **~4-8 hours of compute, ~1-2 weeks calendar** |

## CI gate (future)

Add to `.github/workflows/ci.yml` once scope stabilizes:

```yaml
- name: Mutation testing (changed critical-path files only)
  if: contains(github.event.pull_request.changed_files, 'src/lib/server/{api,middleware,hardware,db}/')
  run: npm run test:mutation -- --incremental
  env:
      STRYKER_BREAK_THRESHOLD: 80
```

Uses stryker's `--incremental` mode + `break: 80` to fail PRs that regress
critical-path mutation score.

## Anti-patterns

- **Don't mutation-test the whole codebase.** It's diminishing returns past
  critical paths. Use layered defense for low-risk code.
- **Don't widen `mutate:` scope mid-PR.** One module per PR keeps runtime
  bounded and makes score delta legible.
- **Don't accept survivors silently.** Either kill them with a test or
  annotate as equivalent with one-line justification.
- **Don't run stryker without checking system load.** Other Claude sessions,
  Argos services, and chromium-mcp share the 8-core Jetson — dial
  concurrency down when those are active.
- **Don't skip the coverage report.** `vitest --coverage` finds zero-coverage
  files in seconds — that's the cheapest win before reaching for stryker.
- **Don't conflate "complete" with "comprehensive".** Layered defense IS
  comprehensive. 100% mutation score on every file is vanity.

## Why this is the right scope

- Phase 1 evidence: mutation testing surfaced 3 zero-coverage files (which
  `vitest --coverage` would find faster) + 28 weak-oracle survivors (most
  on defensive code). It found ZERO actual source bugs.
- Real value: future regressions on the 5 api files now caught.
- Marginal value of expanding to utils/types/UI: each additional file adds
  more compute cost than safety. Diminishing returns are steep past
  security/correctness layers.
- Industry reality: Google/Meta don't mutation-test entire monorepos. They
  mutation-test what costs money to get wrong.
