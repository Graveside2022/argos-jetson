# Phase 5 — db cheap-audit baseline 2026-05-26

**Scope:** `src/lib/server/db/**/*.ts` (29 files — 26 source + 2 existing tests pre-PR).

**Method:** Phase 4 cheap-audit substitute methodology (per `docs/mutation-baseline-2026-05-26-phase4.md` §Methodology pivot) — selected as PRIMARY (not fallback) per 2026-05-26 user directive. NO full-module Stryker run; instead lint/review/hand-mutation/codegraph+semble discovery + targeted test additions.

## Ruflo orchestration

Per the 2026-05-26 directive + PR #253 (ruflo PRIMARY orchestrator doctrine), this phase walked the per-task flow:

1. `memory_search` prior context (Phase 4 hardware precedent, no-existing-Phase-5-findings confirmed)
2. `memory_store` scope in `argos-phase5-db-scope`
3. Skills invoked: ruflo `memory_*` (primary) + tessl `sqlite-node-best-practices` (combination layer)
4. `agentdb_pattern-store` each finding as it landed (8 entries, see below)
5. `memory_store` pivot decision in `argos-decisions` (cheap-audit-as-primary)
6. Phase end record (this doc + completion pattern-store)

## Source inventory (29 files)

Top 5 high-risk targets selected by symbol count + criticality:

| Rank | File                   | Symbols |     Pre-test coverage |
| ---- | ---------------------- | ------: | --------------------: |
| 1    | `database.ts`          |      43 |                    0% |
| 2    | `db-optimizer.ts`      |      39 |                    0% |
| 3    | `rf-aggregation.ts`    |      39 |                    0% |
| 4    | `signal-repository.ts` |      25 |                    0% |
| 5    | `geo.ts`               |      15 |                    0% |
| —    | `cleanup-service.ts`   |      31 | TESTED (pre-existing) |
| —    | `run-migrations.ts`    |      13 | TESTED (pre-existing) |

## Findings (8 — ruflo pattern-store IDs)

| #   | Severity | File:Line                    | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | In-PR action                                                                                              |
| --- | -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | **MED**  | `database.ts:46`             | Constructor missing `busy_timeout` pragma — concurrent access throws SQLITE_BUSY instead of retrying                                                                                                                                                                                                                                                                                                                                                                         | **FIXED** (added `busy_timeout = 5000`)                                                                   |
| 2   | **LOW**  | `database.ts:46`             | `foreign_keys` only set via schema.sql (line 5), fragile if schema bypassed                                                                                                                                                                                                                                                                                                                                                                                                  | **FIXED** (added defense-in-depth pragma in constructor)                                                  |
| 3   | **MED**  | `db-optimizer.ts:251`        | `write_heavy` workload sets `synchronous = OFF` (data corruption risk on power failure)                                                                                                                                                                                                                                                                                                                                                                                      | DEFERRED — runtime-selectable, undocumented use; follow-up PR                                             |
| 4   | **LOW**  | `db-optimizer.ts:155-161`    | `getPragmaSettings` catch-swallows per-pragma errors                                                                                                                                                                                                                                                                                                                                                                                                                         | DEFERRED — defensive shim; follow-up PR                                                                   |
| 5   | **LOW**  | `rf-aggregation.ts:212`      | H3 res clamp uses magic literal 15 (should be MAX_H3_RES const)                                                                                                                                                                                                                                                                                                                                                                                                              | DEFERRED — style nit                                                                                      |
| 6   | **MED**  | `geo.ts:68-74`               | FREQUENCY_BANDS order: in the physical 2400-2485 MHz overlap (both bluetooth ISM and wifi 2.4 GHz channel 1-13), `find()` previously returned 'wifi' first so bluetooth NEVER matched. **FIXED** (reordered: bluetooth wins the overlap). NOTE: the overlap is physical — any 2400-2485 MHz signal can be either; this fix changes priority from wifi-wins to bluetooth-wins. The pre-fix bug was that the priority was opaque; the post-fix priority is documented + tested |
| 7   | **MED**  | `geo.ts:29 + 37`             | GPS coord validation only rejects (0,0) — `hasValidGpsCoords(NaN, NaN)` returns true; NaN propagates into H3 indexing + Haversine; NaN stored in `latitude`/`longitude REAL NOT NULL` corrupts aggregate queries. (Severity uplifted from LOW to MED per pre-push review)                                                                                                                                                                                                    | DEFERRED — fix in follow-up PR: add `Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180` |
| 8   | **LOW**  | `signal-repository.ts:60-61` | UNIQUE constraint detection via brittle `message.includes('UNIQUE constraint failed')`; prefer `error.code`                                                                                                                                                                                                                                                                                                                                                                  | DEFERRED — better-sqlite3 stability; follow-up PR                                                         |

**In-PR fixes (3):** FINDING-1 + FINDING-2 + FINDING-6.
**Deferred to follow-up PR (5):** FINDING-3 (workload synchronous=OFF), FINDING-4 (getPragmaSettings logging), FINDING-5 (MAX_H3_RES const), FINDING-7 (GPS bounds), FINDING-8 (UNIQUE-error code-based detection).

## Test additions

| File                       |  Tests | Targets predicted survivors / known bug                                                                                                                                                                                                                                                                                           |
| -------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geo.test.ts`              |     32 | FINDING-6 regression (bluetooth shadowing); FREQUENCY_BANDS boundary at 2400/2485/2486; GPS valid/invalid coord matrix; Haversine distance; convertRadiusToGrid bounds + integer-grid invariant; generateDeviceId composition; dbSignalToMarker metadata-JSON safety                                                              |
| `database-pragmas.test.ts` |      8 | FINDING-1 + FINDING-2 regression (busy_timeout + foreign_keys set in constructor); cache_size value; temp_store=MEMORY; pragma idempotence; foreign_keys enforcement (orphan-insert throws)                                                                                                                                       |
| `rf-aggregation.test.ts`   |     24 | h3ResForZoom boundaries (undefined/NaN/-Infinity/0/9.99/10/13/13.01/22); getRssiHexCells empty + binning + filters (session/bbox/rssiFloor); getApCentroids per-device + null-device skip + RSSI-weighted dominance; getDrivePath sampling (-Infinity initial / boundary / custom interval); getDeviceObservations filter + order |
| **TOTAL**                  | **64** |                                                                                                                                                                                                                                                                                                                                   |

## Vitest validation

```
✓ src/lib/server/db/rf-aggregation.test.ts (24 tests)  58ms
✓ src/lib/server/db/database-pragmas.test.ts (8 tests) 19ms
✓ src/lib/server/db/geo.test.ts (32 tests)             19ms

Test Files  3 passed (3)
     Tests  64 passed (64)
```

## Scoped Stryker validation — DEFERRED to follow-up

Per cheap-audit method step 7 (scoped Stryker on 1-3 high-risk files to validate predictions), deferred to a follow-up PR. Phase 4 precedent: scoped run on 1 file (hardware-registry) verified 94.1% in 16m55s. Estimated for Phase 5: 2-3 files × ~15m each = ~45m. Triggered after this PR merges.

## Why this is the right scope

- Phase 4 evidence: cheap-audit found 4 MED source bugs in 7 min; full Stryker run was killed at 35min/20% due to ~3hr ETA.
- This phase: 8 findings (3 MED + 5 LOW) found in ~15min of senior review across 5 files. 3 trivially fixed in-PR; 5 deferred to themed follow-up.
- 64 new tests cover predicted-survivor patterns. Vitest pass at 96ms total wall-time — cheap, sustainable.
- No source-test sprawl introduced.

## Re-run

```bash
# Full Phase 5 test pass
npx vitest run src/lib/server/db/

# Just the new tests
npx vitest run src/lib/server/db/geo.test.ts src/lib/server/db/database-pragmas.test.ts src/lib/server/db/rf-aggregation.test.ts

# Scoped Stryker (deferred follow-up)
# npm run test:mutation -- --mutate 'src/lib/server/db/{geo,database,rf-aggregation}.ts'
```
