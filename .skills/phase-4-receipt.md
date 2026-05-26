# Phase 4 — Skill Invocations

Mutation-roadmap row 3: `src/lib/server/hardware/` (18 source files, CRITICAL race-conditions on USB device claim/release).

## Skill Invocations

- Invoked `tessl__graceful-degradation`
  How applied: applied iron-rule (every external call gets timeout + fallback) to claim/release pathways through `resource-manager.ts` and `resource-mutex.ts`; verified existing code already uses `AbortSignal`-equivalent claim timeouts + fallback to `'unavailable'` status; informed test cases for retry-with-backoff on contention and per-device circuit-breaker patterns.

- Invoked `tessl__software-security`
  How applied: review pass for CodeGuard always-apply rules — no hardcoded creds in hardware/, no SQL paths (in-memory Map only), no crypto. Defensive-coding focus: validated that `HardwareRegistry.unregister()` returns boolean for caller branching, `updateStatus()` no-ops on unknown IDs, no path-traversal risk in `device` field handling (USB paths trusted from kernel sysfs).

- Invoked `tessl__abstract-state-analyzer`
  How applied: reasoned about `resource-mutex.ts` race-condition properties — interval/null/state domain analysis on the lock-acquire / lock-release / contention paths to identify mutants that survive without state-aware tests (e.g., off-by-one on retry counters, null-deref on stale lock holder).

## Mutation score before / after

`<NN>` / `<NN>` (≥ 80% required) — to be populated after stryker baseline + post-fix runs.

## Survivors triaged in

`docs/mutation-baseline-2026-05-26-phase4.md` — to be committed alongside the Phase 4 PR.
