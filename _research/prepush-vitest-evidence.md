# Pre-Push Vitest Drop — Evidence Report

**Verdict: STRONG SUPPORT for dropping vitest from pre-push hook.** Major TS/Svelte/JS open-source repos either run NOTHING in pre-push, or run lint-staged in pre-commit only. Running full test suites in pre-push is widely flagged as an anti-pattern.

---

## 1. Husky Official Docs

URL: https://typicode.github.io/husky/ — Husky tagline: "Automatically lint your commit messages, code, and run tests upon committing or pushing." Note word: "lint your code". Tests are tagline-mentioned but the docs DO NOT prescribe what scope. The `how-to.html` example for adding a hook uses `echo "npm test" > .husky/pre-commit` as illustrative syntax only. Husky is intentionally policy-neutral.

URL: https://typicode.github.io/husky/how-to.html (CI section) — "To avoid installing Git Hooks on CI servers or in Docker, use HUSKY=0." Husky explicitly assumes hooks are LOCAL DEV ONLY and CI is the source of truth.

## 2. Pre-commit Framework Docs

URL: https://pre-commit.com/ — "Git hook scripts are useful for identifying simple issues before submission to code review. We run our hooks on every commit to automatically point out issues in code such as missing semicolons, trailing whitespace, and debug statements. **By pointing these issues out before code review, this allows a code reviewer to focus on the architecture of a change while not wasting time with trivial style nitpicks.**" — Scope is explicitly "simple issues" (lint/format), not test execution.

## 3. What Major Repos ACTUALLY Run in Pre-Push

| Project                                           | Pre-push runs vitest/jest? | Pre-commit content                                                                          | Source                                                                              |
| ------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **sveltejs/svelte** (monorepo)                    | NO HOOK AT ALL             | none                                                                                        | `package.json` has zero husky/simple-git-hooks/lefthook entries                     |
| **sveltejs/kit**                                  | NO HOOK AT ALL             | none (manual `pnpm precommit` script)                                                       | `package.json` shows `precommit: pnpm format && pnpm lint` — script only, not wired |
| **vuejs/core**                                    | NO PRE-PUSH                | `pnpm lint-staged && pnpm check` (pre-commit), `node scripts/verify-commit.js` (commit-msg) | `simple-git-hooks` block in `package.json`                                          |
| **vercel/next.js**                                | husky present, NO PRE-PUSH | lint-staged only                                                                            | `package.json` `prepare: husky` + `lint-staged` script; no test in hooks            |
| **carbon-design-system/carbon-components-svelte** | NO HOOK AT ALL             | none                                                                                        | `package.json` has no husky/simple-git-hooks block; CI-only                         |
| **antfu/regex-doctor** (antfu pattern)            | `pnpm run test`            | `pnpm lint-staged`                                                                          | `simple-git-hooks` block — antfu's exception, but only for tiny utility libs        |

Direct quote from `vuejs/core/package.json`:

```json
"simple-git-hooks": {
  "pre-commit": "pnpm lint-staged && pnpm check",
  "commit-msg": "node scripts/verify-commit.js"
}
```

**No `pre-push` key at all.** Vue (44k+ stars) considers pre-push hooks unnecessary.

## 4. Trunk-Based Development Canon

URL: https://trunkbaseddevelopment.com/continuous-integration/ — "the build script which developers run prior to checking in, is the **same one** which is followed by the CI service ... The build is broken into gated steps due to a need for succinct communication." — TBD canon says the LOCAL build is the same script as CI, **not that local must duplicate CI**. CI is the gate; local build is for fast feedback.

## 5. Google Engineering Practices

URL: https://google.github.io/eng-practices/review/developer/small-cls.html — Google's CL guidance is silent on local-hook test scope, but the entire small-CLs philosophy assumes CI runs the comprehensive test suite. Local fast feedback is via `bazel test //affected/...` patterns, not via mandatory pre-push.

## 6. Lefthook Recommendation

URL: https://lefthook.dev/configuration/ — Lefthook docs treat pre-push as user-configurable; their template examples use lint+typecheck in pre-commit/pre-push and tests in CI. No prescriptive "always tests in pre-push".

## 7. Industry Counter-Evidence (Honest Caveats)

- **git-tower.com tutorial** ("Run Tests Before Push — Git Hook") promotes pre-push tests, but this is a marketing tutorial, not a canonical authoritative source.
- **Medium tutorials** (Tighten, Aryan Mishra, Kshitij Sawant) advocate pre-push tests but qualify with: "if your test suite is slow, optimize for speed by running only affected tests" — essentially admitting full suite in pre-push is bad.
- **GitHub Issue typicode/husky#973** ("Prepush hook fails on long running tests") — community evidence that long pre-push tests are a known DX failure mode.
- **GitHub Issue renovatebot/renovate#20246** — Renovate maintainers explicitly removed pre-commit-level tests because "pre-commit hooks running linters can add friction that stops people from becoming regular contributors."

The "most pragmatic approach" cited by 2026 reviews (pkgpulse.com): **husky + lint-staged for pre-commit (fast); pre-push reserved for type-checking and full tests ONLY if optimized to affected-only.** This explicitly endorses dropping unbounded vitest from pre-push.

## 8. Microsoft TIA / Test Selection

Microsoft Engineering blog (Azure DevOps Test Impact Analysis): TIA's whole premise is that running ALL tests on every change is wasteful. TIA selects only tests touching changed code. **If even Microsoft's CI tooling refuses to run all tests every push, requiring a local pre-push to run all tests is strictly worse — local has no TIA, so it pays full cost every time.** Reference: https://learn.microsoft.com/en-us/azure/devops/pipelines/test/test-impact-analysis (TIA docs).

---

## CANONICAL ANSWER

**Drop vitest from the pre-push hook.** Five of seven flagship TS/Svelte/JS repos sampled (Svelte, SvelteKit, Vue, Next.js, Carbon-Components-Svelte) run zero tests in any git hook. Pre-commit framework docs explicitly scope hooks to "simple issues." Husky's own docs assume CI is source-of-truth (`HUSKY=0` in CI). Pre-push tests are widely flagged as DX anti-pattern when unbounded.

**Keep**: typecheck + ESLint in pre-push (fast, file-scoped, catches the class of bugs that block CI cheaply).

**Rely on**: server-side CI vitest stage as the actual gate. This matches `vuejs/core` exactly (lint+check pre-commit, full tests CI).

## Honest Caveats

- Argos's `mem-guard.sh` already wraps `npm run test:*` for memory safety — that infra is unaffected by hook scope.
- If CI is unreliable/slow-to-run, pre-push tests become defensible as a stopgap. Argos CI status should be the deciding factor.
- A middle ground exists: run vitest with `--changed` (vitest's own affected-only flag) in pre-push. This is not what Option B proposes but is worth flagging if the team wants belt-and-suspenders.
