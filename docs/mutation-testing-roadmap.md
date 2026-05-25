# Mutation Testing Roadmap — comprehensive codebase audit

**Goal:** every TypeScript source file under `src/` has stryker-verified
mutation score ≥ 80% (stryker `high` threshold). Track-A trunk-health work.

**Started:** 2026-05-25 (PR establishing infrastructure + first module).

**Strategy:** module-by-module incremental expansion. NO nuke-and-rewrite —
preserves existing tests as the regression net + behavioral oracle while
stryker surfaces weak spots per module. Each module's PR ships a measurable
score gain.

## Method

1. Pick next module from the phase list below.
2. Add module path to `stryker.config.mjs` `mutate:` array (single-PR scope).
3. Run `npm run test:mutation` → baseline score.
4. Triage survivors (see existing `mutation-baseline-2026-05-25.md` for
   the per-mutator action table).
5. Add tests until module hits ≥ 80%. Equivalent mutants get
   `// Stryker disable next-line <Mutator>` annotation with one-line
   justification.
6. Re-run `npm run test:mutation` → verified score.
7. Ship PR. Update this roadmap's status column.

## CI gate

Once stryker is in CI (post-Phase 1), every PR touching `src/**/*.ts` runs
`npm run test:mutation` on the scoped diff. Stryker `break: 80` blocks merge
on regression.

Note: full-suite stryker runs are SLOW (~38 min for 5 files on RPi5 single-
fork). CI strategy is per-module scoping driven by file diff, not whole-
codebase per-PR.

## Phase list

Lower-layer modules first — utility code has fewer dependencies + faster
mutation runs. Higher-layer (components, routes) need more mock infrastructure.

### Phase 1 + 1.5 — API utility layer (5 files) — DONE 2026-05-25

| File                                       |      Score | Mutants |               Survived |
| ------------------------------------------ | ---------: | ------: | ---------------------: |
| `src/lib/server/api/create-handler.ts`     |     93.33% |      45 |         3 (equivalent) |
| `src/lib/server/api/error-utils.ts`        |     92.59% |      27 |         2 (equivalent) |
| `src/lib/server/api/rf-query-schemas.ts`   |    100.00% |      72 |                      0 |
| `src/lib/server/api/webrx-control-lock.ts` |    100.00% |       3 | 0 (+2 timeouts killed) |
| `src/lib/server/api/webrx-hackrf-claim.ts` |    100.00% |      43 |                      0 |
| **Phase total**                            | **97.37%** | **190** | **5 (all equivalent)** |

All 5 remaining survivors are documented + annotated equivalent mutants
(see triage doc). Phase complete.

Triage doc: [`mutation-baseline-2026-05-25.md`](./mutation-baseline-2026-05-25.md)
— full per-survivor analysis + equivalence justifications.

### Phase 2 — utility / pure layer

| Module                    | Est files | Notes                                                                            |
| ------------------------- | --------: | -------------------------------------------------------------------------------- |
| `src/lib/utils/**/*.ts`   |       ~40 | Pure functions, no IO. Should mutation-score well with existing colocated tests. |
| `src/lib/types/**/*.ts`   |       ~30 | Mostly type aliases (zero mutants) + small validators.                           |
| `src/lib/schemas/**/*.ts` |       ~15 | Zod schemas. Property-based testing via fast-check belongs here.                 |

### Phase 3 — server data layer

| Module                              | Est files | Notes                                                      |
| ----------------------------------- | --------: | ---------------------------------------------------------- |
| `src/lib/server/db/**/*.ts`         |       ~25 | better-sqlite3. Tests need real `:memory:` DB.             |
| `src/lib/server/hardware/**/*.ts`   |       ~50 | resource-manager, device claims. Heavy mocking.            |
| `src/lib/server/middleware/**/*.ts` |       ~10 | auth, csrf, security-headers. Per-endpoint contract tests. |

### Phase 4 — server services

| Module                            | Est files | Notes                                                                   |
| --------------------------------- | --------: | ----------------------------------------------------------------------- |
| `src/lib/server/services/**/*.ts` |      ~150 | Biggest layer. Per-sub-module sub-phases (hackrf/, kismet/, tak/, etc). |

### Phase 5 — route handlers

| Module                         | Est files | Notes                                                              |
| ------------------------------ | --------: | ------------------------------------------------------------------ |
| `src/routes/api/**/+server.ts` |       ~50 | RequestHandler endpoints. Test via `createHandler` + mocked event. |

### Phase 6 — frontend (Svelte 5)

| Module                           | Est files | Notes                                                                                       |
| -------------------------------- | --------: | ------------------------------------------------------------------------------------------- |
| `src/lib/stores/**/*.svelte.ts`  |       ~30 | Runes-based state stores. Per-store unit tests.                                             |
| `src/lib/state/**/*.svelte.ts`   |       ~15 | State machines / derived state.                                                             |
| `src/lib/components/**/*.svelte` |      ~200 | Component testing. Stryker may not handle .svelte well — verify in spike before committing. |

### Phase 7 — Rust crate (separate)

`tactical/blue-dragon/**` — uses Rust + cargo. Stryker is JS/TS only.
Switch to `cargo-mutants` for this crate. Separate roadmap.

## Estimated effort

|     Phase |      Files |   Est PRs | Est calendar weeks |
| --------: | ---------: | --------: | -----------------: |
|         1 |          5 |      done |               done |
|       1.5 |          5 |         1 |                0.5 |
|         2 |        ~85 |       3-4 |                1-2 |
|         3 |        ~85 |       4-5 |                2-3 |
|         4 |       ~150 |      8-12 |                4-6 |
|         5 |        ~50 |       3-4 |                  2 |
|         6 |       ~245 |     10-15 |                4-8 |
|         7 | Rust crate |       2-3 |                1-2 |
| **Total** |   **~620** | **31-45** |    **14-23 weeks** |

Single-engineer estimate. Parallel work via worktrees can compress this.

## Out of scope (for now)

- Mutation testing of `tests/**` files themselves (self-referential).
- Generated files: `.svelte-kit/`, `build/`, `node_modules/`.
- Third-party vendored code in `static/`.
- Configuration files (`*.config.ts`, `*.config.js`, `dangerfile.js`).

## Anti-patterns to avoid

- **Don't nuke-and-rewrite tests.** Existing tests are the behavioral oracle
    - regression net during transition. Tighten in place; only delete tests
      that are demonstrably useless (no assertion, or assertion-on-mock-shape).
- **Don't widen `mutate:` scope mid-PR.** One module per PR keeps runtime
  bounded + makes the score delta legible.
- **Don't accept survivors silently.** Either kill them with a test or
  annotate as equivalent with a one-line justification. The TRIAGE doc
  for each module is the audit trail.
- **Don't skip the re-run.** A "should kill it" test that wasn't verified
  by stryker doesn't count toward score. Always re-baseline after additions.
