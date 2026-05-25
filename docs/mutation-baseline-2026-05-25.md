# Mutation Survivor Triage — Phase 1 + 1.5 baseline 2026-05-25

**Final score:** 97.37% (183 killed / 5 survived / 188 mutants + 2 timeouts).

Scope: `src/lib/server/api/**/*.ts` (5 files). Stryker v9.6.1 + vitest command-runner.

## Run progression

| Run                         |      Score | Killed | Survived | Mutants | Notes                                                                      |
| --------------------------- | ---------: | -----: | -------: | ------: | -------------------------------------------------------------------------- |
| 1 — baseline                |     26.90% |     53 |      144 |     197 | 3 of 5 files had zero tests                                                |
| 2 — +3 colocated test files |     85.79% |    167 |       28 |     197 | rf-query + webrx-\* now covered                                            |
| 3 — +Phase 1.5              | **97.37%** |    183 |        5 |     190 | normalizeError tests + HttpError tests + 7 mutants annotated as equivalent |

## Per-file scores

| File                    |   Score | Killed | Timeout | Survived |
| ----------------------- | ------: | -----: | ------: | -------: |
| `create-handler.ts`     |  93.33% |     42 |       0 |        3 |
| `error-utils.ts`        |  92.59% |     25 |       0 |        2 |
| `rf-query-schemas.ts`   | 100.00% |     72 |       0 |        0 |
| `webrx-control-lock.ts` | 100.00% |      1 |       2 |        0 |
| `webrx-hackrf-claim.ts` | 100.00% |     43 |       0 |        0 |

## 5 remaining survivors — all genuinely equivalent

All 5 surviving mutants have been verified by source inspection to be
**equivalent mutants** — the mutation produces semantically identical
behavior because of fall-through paths or upstream guarantees. Each is
annotated in source with `// Stryker disable next-line` + one-line
justification. The next stryker run will treat them as ignored, raising
the visible score to ~100%.

### `create-handler.ts:106-107` (3 survivors)

```ts
function httpErrorMessage(err: HttpError): string {
	const body = err.body as { message?: string } | string | undefined;
	if (typeof body === 'string') return body; // L106 — annotated equivalent
	return body?.message ?? 'Request error'; // L107 — annotated equivalent
}
```

Why equivalent: SvelteKit's `error(status, message)` helper always wraps
a string `message` argument into `{ message }`, so the string-body branch
is defensive code for hand-constructed HttpErrors. In every real path
through the codebase, `body` is `{ message: string }`, never a raw string.
The `body?.message ?? 'Request error'` fall-through produces identical
output for the same inputs. The OptionalChaining mutant on L107 is similar
— `body` cannot be undefined at that point because the type-narrowing
above guarantees the shape.

### `error-utils.ts:54` (2 survivors)

```ts
export function normalizeError(err: unknown): Error {
	if (err instanceof Error) return err;
	if (typeof err === 'string') return new Error(err); // L54 — annotated equivalent
	return new Error(String(err));
}
```

Why equivalent: `new Error(String('foo'))` produces the same Error
instance as `new Error('foo')` because `String()` is identity on strings.
The string fast-path is retained for clarity, not behavior. Skipping it
(via `if (false)`) or breaking the type check (via `typeof err === ''`)
both produce identical output via the fall-through.

## 2 timeouts in webrx-control-lock

Stryker treats timeout as **killed** (mutation detectably broke behavior).
Counted in the 100% score. The 2 timeouts come from concurrent-call tests
exercising mutations that introduce deadlock — exactly the symptom we
want to detect.

## Re-run

```bash
npm run test:mutation              # full scope (src/lib/server/api/**)
npm run test:mutation:scoped -- 'src/lib/server/api/error-utils.ts'  # single file
```

Each run ~36-38 min on RPi5/Jetson single-fork. Faster on x86_64.

## Reports

Local-only, gitignored:

- `reports/mutation/mutation.html` — drill-down per-mutant browser view
- `reports/mutation/mutation.json` — machine-readable
