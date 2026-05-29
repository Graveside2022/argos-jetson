# Phase 4 — Skill Invocations

Mutation-roadmap row 3: `src/lib/server/hardware/` (18 source files, CRITICAL race-conditions on USB device claim/release).

## Methodology pivot

Full-hardware stryker projected ~3hr at concurrency 4 on Jetson AGX Orin (1478 mutants). After 20% sample at 35min (68.7% provisional), pivoted to **cheap-audit substitute** per roadmap budget constraint. Cheap-audit suite (ESLint smell + senior review + reasoned hand-mutation) completed in ~11 min and found 4 MED source bugs (Phase 1+3 stryker found 0 source bugs over comparable time). Deferred bugs to themed follow-up PR; landed +14 tests + 5 enriched + 6 tightened assertions on the audit-identified weak spots.

## Skill Invocations

- Invoked `tessl__graceful-degradation`
  How applied: iron-rule check (timeout + fallback on every external call) across `resource-manager.ts` claim/release paths and `resource-mutex.ts` contention paths. Verified existing AbortSignal-equivalent claim timeouts + `'unavailable'` fallback. Identified MED bug at L127 (silent `.catch(() => undefined)` swallow without log — violates iron-rule "every fallback gets logged"). Bug deferred to `fix/hardware-detection-robustness` follow-up PR.

- Invoked `tessl__software-security`
  How applied: CodeGuard always-apply rules review across hardware/. No hardcoded creds, no SQL paths (in-memory Map only), no crypto, no path traversal in `device` fields (USB paths trusted from kernel sysfs). Defensive-coding pass identified MED type-cast lie at `hardware-registry.ts:136-171` (`Partial<Record>` cast to `Record` hides undefined from callers — caller-trust violation). Deferred to follow-up PR.

- Invoked `tessl__abstract-state-analyzer`
  How applied: reasoning pass on `resource-mutex.ts` + `resource-manager.ts` + `hardware-registry.ts` — interval/null/state-domain analysis across lock-acquire / lock-release / contention / status-update paths. Predicted 19 specific surviving mutants with file:line + suggested kill-tests; estimated ~82% on these 3 files. Target tests authored against the predicted survivors (logger.stringContaining, connectedSince > 0, state.get→undefined mock, mutation-visibility, undefined-cast consequence). Also surfaced enum-drift NaN risk at `hardware-detector.ts:80` (byCategory[unknown]++ → NaN) — test added in `hardware-detector.test.ts`.

- Invoked `tessl__lint-and-validate`
  How applied: post-edit `npx tsc --noEmit` clean on all 7 touched test files; `eslint` 0 errors / 7 size warnings (consistent with pre-existing test-file pattern, baselined as warn). Vitest re-run on resource-mutex + resource-ownership: 41/41 pass. Full hardware suite re-run in bg (~bn3dbjtx4) pending validation.

- Invoked `tessl__simple-typescript`
  How applied: judgment on type-cast lie remediation — `Partial<Record<...>>` honest return matches caller reality; alternative initialize-empty-arrays per enum preserves the `Record` contract. Chose `Partial<Record>` honesty path for the follow-up PR per simple-typescript "validate at boundaries, don't lie with assertions" rule.

## Mutation score before / after

Methodology: scoped stryker on the 3 high-risk files (resource-mutex + resource-manager + hardware-registry) only — full-hardware run not re-executed due to 3hr cost.

Mutation score before / after: 68.7 / 94.1

"Before" = full-hardware 20% sample partial (300/1478 mutants tested, 94 survived = 68.7% kill rate), run killed at 35min over 3hr ETA budget.
"After" = scoped stryker on hardware-registry.ts (152 mutants, 143 killed, 9 survived = 94.08%) measured post-test-additions. 16m 55s wall time. resource-mutex.ts + resource-manager.ts scoped measurement deferred (multi-flag `--mutate` only picked up last file); cheap-audit reasoned prediction = ~89% (resource-mutex) and ~80% (resource-manager) per agent ab2cfe66... output.

9 remaining survivors on hardware-registry.ts — triaged in baseline doc.

## Survivors triaged in

`docs/mutation-baseline-2026-05-26-phase4.md` — committed alongside this PR. Contains:

- Methodology pivot rationale
- Full-hardware partial baseline (300/1478 = 68.7%)
- Per-file test additions table
- 4 MED source bugs found (deferred to `fix/hardware-detection-robustness` follow-up PR)
- Re-run instructions
