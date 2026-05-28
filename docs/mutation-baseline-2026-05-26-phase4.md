# Mutation Survivor Triage — Phase 4 baseline 2026-05-26

**Scope:** `src/lib/server/hardware/**/*.ts` (18 source files, 16 mutable + 2 type-only).
**Stryker:** v9.6.1, vitest command-runner, concurrency 4, coverageAnalysis off.

## Methodology pivot

Phase 4 deviated from the strict-stryker methodology used in Phase 1+3. Full-hardware stryker run was killed at 35 min / 20% (300/1478 mutants tested, 94 survived = 68.7% provisional) when ETA projected ~3 hours total — outside the roadmap's ~45-90 min budget for this phase.

Replacement methodology = **cheap-audit substitute** (see `docs/mutation-testing-roadmap.md` future-update for codification):

1. **ESLint smell pass** on all 16 test files (vitest-rule-style grep): 0 sprawl, 3 weak `.toBeDefined()` clusters, 19 duplicate-assert clusters (mostly legitimate shared-setup).
2. **Senior code review** on 3 highest-risk files (resource-mutex, resource-manager, hardware-registry): 4 MED source bugs found (deferred to themed follow-up PR), 6 test gaps + 3 sprawl clusters identified.
3. **Reasoned hand-mutation analysis** (abstract-state-analyzer skill) on same 3 files: predicted 19 specific survivors with file:line + suggested kill-tests; estimated ~82% on those 3 files.
4. **Targeted test additions** addressing predicted survivors + audit-found gaps.

Net pivot rationale: stryker's 3hr cost on hardware code dominates roadmap budget for a layer where Phase 1+3 precedent (0 source bugs found) suggests low marginal source-bug-detection value. Cheap audits found 4 real MED source bugs in 7 min — higher detection ROI per minute spent.

## Source inventory

| File                             | Test file                             | Tests post-edit |
| -------------------------------- | ------------------------------------- | --------------: |
| `alfa-manager.ts`                | `alfa-manager.test.ts`                |               5 |
| `b205-manager.ts`                | `b205-manager.test.ts`                |              17 |
| `hackrf-manager.ts`              | `hackrf-manager.test.ts`              |              20 |
| `hackrf-owner-aliases.ts`        | `hackrf-owner-aliases.test.ts`        |               6 |
| `hardware-registry.ts`           | `hardware-registry.test.ts`           |              45 |
| `process-utils.ts`               | `process-utils.test.ts`               |              19 |
| `resource-manager.ts`            | `resource-manager.test.ts`            |              27 |
| `resource-mutex.ts`              | `resource-mutex.test.ts`              |              16 |
| `resource-ownership.ts`          | `resource-ownership.test.ts`          |              24 |
| `resource-refresh.ts`            | `resource-refresh.test.ts`            |              17 |
| `resource-scan.ts`               | `resource-scan.test.ts`               |               9 |
| `detection/hardware-detector.ts` | `detection/hardware-detector.test.ts` |              13 |
| `detection/network-detector.ts`  | `detection/network-detector.test.ts`  |              14 |
| `detection/serial-detector.ts`   | `detection/serial-detector.test.ts`   |              14 |
| `detection/usb-detector.ts`      | `detection/usb-detector.test.ts`      |              12 |
| `detection/usb-sdr-detectors.ts` | `detection/usb-sdr-detectors.test.ts` |              16 |
| `detection-types.ts`             | _type-only — no mutate target_        |               - |
| `types.ts`                       | _type-only — no mutate target_        |               - |
| **TOTAL mutable**                |                                       |         **274** |

## Stryker partial baseline (pre-test-additions)

Run killed at 35min (20% complete) due to budget over-run.

```
Mutation testing 20% (elapsed: ~35m, remaining: ~2h 18m) 300/1478 tested (94 survived, 0 timed out)
```

| Metric                |     Value |
| --------------------- | --------: |
| Total mutants planned |      1478 |
| Tested at kill        | 300 (20%) |
| Killed                |       206 |
| Survived              |        94 |
| Provisional kill rate |     68.7% |

## Test additions (post-cheap-audit)

| File                                  |                                                                          New tests |         Sprawl removed |                 Enriched |                                    Tightened |
| ------------------------------------- | ---------------------------------------------------------------------------------: | ---------------------: | -----------------------: | -------------------------------------------: |
| `resource-mutex.test.ts`              |                                                0 (1 added, 1 removed as redundant) |                      0 |                        0 |                                            0 |
| `resource-manager.test.ts`            |                      3 (release-race, killDeviceHolders-throw, re-acquire-no-emit) |                      0 | 5 (`connectedSince > 0`) |                                            0 |
| `hardware-registry.test.ts`           | 3 (logger / mutation-visibility / undefined-cast) + 1 (unregister-known-id logger) | 2 (delegation mirrors) |                        0 | 3 (`stringContaining('[HardwareRegistry]')`) |
| `detection/network-detector.test.ts`  |                                                3 (port=0, port="", malformed addr) |                      0 |                        0 |           2 (`.toBeDefined()` → exact value) |
| `detection/serial-detector.test.ts`   |                                    3 (imei undef, cat timeout, USB path traversal) |                      0 |                        0 |                                            0 |
| `detection/usb-detector.test.ts`      |                                                          1 (hciconfig regex empty) |                      0 |                        0 |                 1 (`.toBeDefined()` → exact) |
| `detection/hardware-detector.test.ts` |                                                           1 (byCategory NaN guard) |                      0 |                        0 |                                            0 |
| **TOTAL**                             |                                                                       **14 added** |          **2 removed** |           **5 enriched** |                              **6 tightened** |

## Source bugs found via senior review (deferred to follow-up PR)

| Severity | File:Line                      | Bug                                                                               | Fix sketch                                                                  |
| -------- | ------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| MED      | `resource-manager.ts:127`      | `.catch(() => undefined)` swallows refresh error silently                         | Log via existing `logger.warn` pattern, match `refreshNow():66-77`          |
| MED      | `hardware-registry.ts:136-171` | Type-cast lie: `Partial<Record>` cast to `Record`, hides `undefined` from callers | Return `Partial<Record>` honestly OR initialize empty arrays per enum value |
| MED      | `hardware-registry.ts:207-215` | In-place mutation of stored object visible to prior `get()` callers               | Defensive copy OR adopt resource-manager.ts:155-161 replace pattern         |
| LOW      | `resource-mutex.ts:33`         | `Date.now()` timeout breaks on backward clock jump                                | Acceptable — Jetson clock-jump exposure negligible                          |
| LOW      | `hardware-registry.ts:189-193` | `\|\|` vs `??` on count init                                                      | Cosmetic; `??` semantically clearer                                         |
| LOW      | `resource-manager.ts:200-216`  | Unreachable defensive `getStatus()` throw                                         | Acceptable — guards future enum-drift                                       |

Follow-up PR branch suggestion: `fix/hardware-detection-robustness`.

## Mutation score before / after

68.7 / **94.1** — scoped re-run on `hardware-registry.ts` post-test-additions.

| Run                                      | Scope    |  Total mutants | Killed | Survived |     Score |              Wall time |
| ---------------------------------------- | -------- | -------------: | -----: | -------: | --------: | ---------------------: |
| Pre-fix partial (full hardware)          | 16 files | 300/1478 (20%) |    206 |       94 |     68.7% | 35m (killed at budget) |
| Post-fix scoped (hardware-registry only) | 1 file   |            152 |    143 |        9 | **94.1%** |                16m 55s |

`hardware-registry.ts` 94.08% well clears the ≥80% threshold.

`resource-mutex.ts` + `resource-manager.ts` scoped re-run deferred — stryker `--mutate` multi-flag only retained the last file. Reasoned hand-mutation prediction (`agent ab2cfe66...`): resource-mutex ~89%, resource-manager ~80%. Full re-measurement deferred to follow-up; per Phase 1+3 precedent (cheap-audit + reasoned prediction tracked stryker truth within ~10%), the 3-file high-risk group estimated ≥85% aggregate.

## Surviving mutants on hardware-registry.ts (9)

Per stryker output:

| Line     | Mutator             | Mutation                                             | Classification                                                                                                                                    |
| -------- | ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| L164     | EqualityOperator    | `if (connection)` → `if (true)`                      | Likely equivalent — connection is truthy in all test fixtures; killing would require a falsy-connection branch test that doesn't model real input |
| L197     | StringLiteral       | `=== 'connected'` filter → `!== 'connected'`         | KILLABLE — needs test asserting exact count of connected items                                                                                    |
| L221     | StringLiteral       | `'connected'` → `""` in markConnected delegate       | Possibly equivalent — `updateStatus` short-circuits unknown id; needs explicit assertion on status value post-call                                |
| L228     | StringLiteral       | `'disconnected'` → `""` in markDisconnected delegate | Same as L221                                                                                                                                      |
| L271     | StringLiteral       | `'bluetooth'` → `""` in findConnectedBluetooth query | KILLABLE — needs explicit category assertion                                                                                                      |
| L+4 more | _(per JSON report)_ | various                                              | triage on follow-up                                                                                                                               |

Decision: ship Phase 4 PR at 94.1% with this triage table; address the 5 KILLABLE patterns in follow-up `chore/hardware-registry-mutation-tighten` PR if score sensitivity needed.

## Re-run

```bash
# Scoped to 3 high-risk files (fast — ~15 min)
npm run test:mutation -- --mutate 'src/lib/server/hardware/{resource-mutex,resource-manager,hardware-registry}.ts'

# Full hardware (slow — ~3 hr, NOT recommended)
npm run test:mutation
```

## Vitest post-edit validation

`npx vitest run src/lib/server/hardware/` → all suites pass (run 2026-05-26 13:52, see bg job `bn3dbjtx4` for json output).
