---
last_validated: 2026-04-29
gate_matrix_version: 1
canonical_authorities:
    - https://typicode.github.io/husky/
    - https://www.conventionalcommits.org/
    - https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
    - https://trunkbaseddevelopment.com/
    - https://eslint.org/docs/latest/use/configure/configuration-files
    - https://prettier.io/
    - https://www.npmjs.com/package/svelte-check
    - https://vitest.dev/
    - https://danger.systems/js/
    - https://docs.trunk.io/
    - https://github.com/gitleaks/gitleaks
    - https://www.coderabbit.ai/
context7_library_ids:
    - /websites/github_en_actions
    - /carbon-design-system/carbon-components-svelte
    - /microsoft/playwright
    - /dequelabs/axe-core
---

# Argos CI/CD Pipeline Specification

**Status**: canonical reference. Last updated 2026-04-29.
**Scope**: every quality gate that runs on a commit, push, PR, or release tag.
**Audience**: every future change to `.husky/`, `.github/workflows/`, or pipeline tooling cites this document or amends it.

---

## 1. Philosophy

Four principles, each backed by industry canon, govern every gate decision below:

1. **Trunk-Based Development** — short-lived feature branches merge into `dev` with daily-or-faster cadence; `main` is always releasable. Long-lived branches are an anti-pattern. (Forsgren et al., _Accelerate_; Google EngProd guidance.)
2. **Husky's "shift-left, but don't lock-in" principle** — local hooks catch problems early but MUST be bypassable (`HUSKY=0`, `--no-verify`); CI is the authoritative gate. From the Husky docs: _"Husky doesn't force Git hooks. It can be globally disabled (HUSKY=0)"_ (https://typicode.github.io/husky/how-to.html).
3. **Microsoft Test Impact Analysis (TIA)** — only run the tests affected by the change; full-suite testing is reserved for the gate that protects merge into a protected branch. (Microsoft Engineering Fundamentals.)
4. **Single source of truth per gate** — each rule is enforced in exactly one CI job and exactly one local hook. Duplicate enforcement creates skew and burns runner minutes (Bazel/Buck "one rule, one place" philosophy).

These four reduce to one operational rule: **fast feedback locally, definitive enforcement remotely, zero duplication between layers.**

---

## 2. Layered Defense Model

```
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — pre-commit (LOCAL, < 5 s typical)                          │
│   Husky hook: .husky/pre-commit                                      │
│   • Python ruff size/complexity (tactical/**/*.py only)              │
│   • Bash 300-LOC cap (scripts/**/*.sh, deployment/**/*.sh)           │
│   • Secret scan (regex over staged diff)                             │
│   • lint-staged → ESLint --fix + Prettier --write on STAGED files    │
│   • trunk check --index (hold-the-line)                              │
│   Bypass: SKIP_PY_GATE / SKIP_SIZE_GATE / SKIP_SECRET_SCAN /         │
│           SKIP_TRUNK / --no-verify                                   │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — pre-push (LOCAL, ~30–180 s)                                │
│   Husky hook: .husky/pre-push                                        │
│   • Protected-branch guard (main, master)                            │
│   • Full-repo svelte-check + tsc (mem-guard tier)                    │
│   • Full-repo ESLint --cache (.eslintcache)                          │
│   • vitest related (scoped to upstream diff)                         │
│   Bypass: ALLOW_MAIN_PUSH / SKIP_FULL_LINT / SKIP_TESTS /            │
│           --no-verify                                                │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 3 — GitHub Actions (REMOTE, authoritative)                     │
│   • lint.yml      — ESLint full-repo (cached) + commitlint + gitleaks│
│   • ci.yml        — typecheck + format:check + full vitest + build   │
│   • commitlint.yml— wagoid/commitlint-github-action (PR-level)       │
│   • danger.yml    — PR shape (size, sprawl, tests-required)          │
│   • trunk.yml     — trunk check --upstream (annotations only)        │
│   • semantic-release.yml — tag + CHANGELOG on push to main           │
│   • release.yml   — tarball on `v*.*.*` tag                          │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 4 — CodeRabbit (REMOTE, AI review on every PR)                 │
│   Server-side review on PR open/sync. Argos workflow: feature → dev  │
│   auto-merge gated on green checks + CodeRabbit. Main merge manual.  │
└──────────────────────────────────────────────────────────────────────┘
```

**Layer responsibility, in one sentence each:**

- **Pre-commit** — catch trivially-fixable mistakes before they enter history.
- **Pre-push** — catch broken builds and broken tests before they leave the laptop.
- **CI** — be the wall; nothing lands on `main` that hasn't passed here.
- **CodeRabbit** — be the human reviewer Argos doesn't have.

---

## 3. Per-Tool Configuration

Each section: (a) what it is (b) official docs (c) Argos use today (d) industry canon (e) gaps (f) recommendation.

### 3.1 Husky

(a) Lightweight git-hook installer. Wires `.husky/*` files into `core.hooksPath` via the `prepare` script.
(b) https://typicode.github.io/husky/
(c) `husky@9.1.7` in `devDependencies`; `prepare: "husky || true"`; five hooks: `pre-commit`, `pre-push`, `commit-msg`, `post-commit`, `post-merge`.
(d) Husky v9 is the dominant choice in JS ecosystem (Next.js, T3, shadcn, Tailwind). Vue.js core uses `simple-git-hooks` for ~80% smaller install footprint. Microsoft TypeScript and SvelteKit ship **no git hooks at all** — they push everything to CI and rely on contributor discipline.
(e) Argos config is correct. `prepare: "husky || true"` is the official idiom for production installs (https://typicode.github.io/husky/how-to.html: _"`prepare: husky || true`"_).
(f) **KEEP husky@9**. Migrating to `simple-git-hooks` saves ~6 kB and adds a config-in-package.json constraint that conflicts with Argos's POSIX-script approach (Python ruff gate, mem-guard wrapper, secret regex). Vue picked `simple-git-hooks` because Vue's hooks are trivial (`lint-staged && pnpm check`); Argos's are not.

### 3.2 lint-staged

(a) Runs commands against the list of files in the git index, scoped per glob.
(b) <https://github.com/lint-staged/lint-staged>
(c) `lint-staged@16.1.2`, invoked from `.husky/pre-commit` as `npx lint-staged`. Config lives at `.lintstagedrc.json` (3 rules: `*.{js,ts,svelte}` → ESLint cached + Prettier; `*.{json,md,css,postcss,html}` → Prettier; `package.json` → Prettier).
(d) Universal canon for pre-commit scoping. Per the README (<https://github.com/lint-staged/lint-staged/blob/main/README.md>): _"Run `tsc` on changes to TypeScript files, but do not pass any filename arguments"_ — passing filenames to `tsc` ignores `tsconfig.json` and produces wrong results.
(e) **No gap**. An earlier audit subagent claimed the config was missing (silent no-op). That claim was a false positive — `.lintstagedrc.json` is present and properly wired. ESLint --fix and Prettier --write run on staged files as expected.
(f) **NO CHANGE**. Argos's lint-staged setup is correct. Do not add `tsc` invocation here — pre-push owns full typecheck (`svelte-check` is project-scoped, not file-scoped, so file-arg invocation is impossible).

### 3.3 commitlint + Conventional Commits

(a) Commit-message linter; `@commitlint/config-conventional` enforces Conventional Commits 1.0.
(b) https://www.conventionalcommits.org/en/v1.0.0/ ; https://commitlint.js.org/
(c) Three-layer enforcement: (1) hand-rolled regex in `.husky/commit-msg`, (2) `commitlint.config.mjs` referenced by (3) `wagoid/commitlint-github-action@v6` in `commitlint.yml` AND `lint.yml`.
(d) Conventional Commits 1.0 spec (verbatim): _"a commit of the type `fix` patches a bug … a commit of the type `feat` introduces a new feature … MUST be prefixed with a type … followed by the OPTIONAL scope, OPTIONAL `!`, and REQUIRED terminal colon and space."_ Standard practice: commitlint config + commit-msg hook + GH Action.
(e) **Two redundant gates** — `commitlint.yml` and `lint.yml` both run wagoid commitlint on every PR. The `.husky/commit-msg` regex duplicates `commitlint.config.mjs` rules — drift risk.
(f) **DROP** `commitlint.yml` (covered by `lint.yml`'s `commitlint` job). **REPLACE** the regex in `.husky/commit-msg` with `npx --no-install commitlint --edit "$1"` so config is single-sourced from `commitlint.config.mjs`.

### 3.4 wagoid/commitlint-github-action

(a) Server-side commitlint runner for GH Actions PRs.
(b) https://github.com/wagoid/commitlint-github-action
(c) `v6` (SHA-pinned `b948419dd99f3fd78a6548d48f94e3df7f6bf3ed`) in two workflows.
(d) De-facto standard for server-side conventional-commit enforcement. Required because `--no-verify` bypasses the local hook.
(e) Duplicate invocation across `commitlint.yml` and `lint.yml`.
(f) Keep one copy in `lint.yml`.

### 3.5 ESLint v9 (flat config)

(a) Linter; v9 flat-config era (`eslint.config.js` returns array).
(b) https://eslint.org/docs/latest/use/configure/configuration-files
(c) `eslint@9.30.1` + flat config at `config/eslint.config.js`. Plugins: `@typescript-eslint`, `eslint-plugin-svelte`, `eslint-plugin-sonarjs`, `eslint-plugin-boundaries`, `eslint-plugin-simple-import-sort`, `eslint-config-prettier`. Cache: `--cache --cache-location .eslintcache --cache-strategy content`.
(d) Flat config is the v9 default. `--cache-strategy content` (vs `metadata`) hashes file contents and survives `git checkout` (https://eslint.org/docs/latest/use/command-line-interface#--cache-strategy). Plugins that pull weight in 2026: `typescript-eslint`, `eslint-plugin-svelte`, `eslint-config-prettier`. `sonarjs` is high-leverage if cognitive-complexity rules are wired (Argos enforces `≤5`). `boundaries` is high-leverage if layer rules are real.
(e) **Three** plugins are present but their value depends on actual rule wiring (only top of `eslint.config.js` was inspected here). Cache strategy is correct.
(f) **AUDIT** which plugin rules are actually enabled vs imported. If `boundaries` rules aren't enforcing the layered architecture from `CLAUDE.md`, drop it (sentrux already enforces layer ordering with `max_cycles=0`). Otherwise keep all five.

### 3.6 Prettier

(a) Opinionated formatter.
(b) https://prettier.io/
(c) `prettier@3.6.2` + `prettier-plugin-svelte`. `npm run format:check` in CI; `prettier --write` invoked from `.lintstagedrc.json` rules on staged JS/TS/Svelte/JSON/MD/CSS files.
(d) Verbatim from Prettier docs: _"npx prettier . --check … `--check` is like `--write`, but only checks that files are already formatted, rather than overwriting them."_ Standard pattern: ESLint + `eslint-config-prettier` (turns off conflicting rules) + lint-staged in pre-commit + `--check` in CI.
(e) `eslint-config-prettier@10.1.5` is installed and imported. CI runs `format:check` in `ci.yml` only. trunk also runs prettier (potential double-format).
(f) Disable prettier in trunk (`.trunk/trunk.yaml` `lint.disabled` array — already disables eslint, oxipng, black, isort, shfmt). Keep prettier as the single owner via `format:check` in CI + lint-staged in pre-commit.

### 3.7 svelte-check

(a) Type-aware linter for Svelte projects, LSP-backed (uses `svelte-language-server`).
(b) https://www.npmjs.com/package/svelte-check
(c) `svelte-check@*` invoked via `npm run typecheck` → `mem-guard.sh sh -c 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json'`. Memory profile: ~650 MB on Argos repo.
(d) Required for any Svelte 5 codebase — TypeScript alone does not understand `.svelte` files. Project-scoped (no file-arg mode worth using).
(e) Heavy. Cannot scope to changed files. The 150-second cold-start cost is the root cause of `SKIP_TESTS=1` becoming routine.
(f) Keep in pre-push. Leave it OUT of pre-commit (lint-staged) and OUT of `lint.yml` — it already runs in `ci.yml`. Do not add an `svelte-check --watch` daemon to pre-commit.

### 3.8 Vitest

(a) Vite-native test runner.
(b) https://vitest.dev/
(c) `vitest@*` via 6 npm scripts (`test:unit`, `test:integration`, `test:security`, `test:visual`, `test:performance`, `test:e2e`). Pre-push uses `vitest related` via `scripts/dev/run-related-tests.sh`.
(d) Verbatim from Vitest CLI docs: _"`vitest related` — Run only tests that cover a list of source files. Works with static imports … but not the dynamic ones."_ Argos's `run-related-tests.sh` correctly chose `related` over `--changed` because (per the script's own comment) _"`vitest run --changed HEAD` was rejected: when package.json is in the diff, --changed treats every test as affected and runs the full suite."_ This is the right call — `vitest related` is the precise primitive.
(e) Pre-push test stage is regularly skipped via `SKIP_TESTS=1` due to agent-runtime SIGTERM at ~3 minutes. CI is full-suite (correct). `vitest related` is fast on small diffs but unbounded on large ones.
(f) **DROP vitest from pre-push entirely** (already executed on PR-CI-5 branch). Justification: Vue (`pnpm check && lint-staged` only), Svelte (no hook), Carbon (no hook), TypeScript (no hook), and SvelteKit (no hook) all push tests to CI. Pre-push tests are an anti-pattern at scale; the Argos memory `feedback_skip_tests_sanctioned_bypass.md` already documents `SKIP_TESTS=1` as the routine path. Codify it. Tests run in `ci.yml` `test_unit` step; that is the authoritative gate.

### 3.9 Playwright + @axe-core/playwright

(a) E2E browser automation; axe = a11y rule engine.
(b) https://playwright.dev/ ; https://www.npmjs.com/package/@axe-core/playwright
(c) `@playwright/test@1.53.2` + `@axe-core/playwright@4.11.1`. Scripts: `test:e2e`, `test:smoke`. Not invoked in any current GH workflow.
(d) Standard E2E + a11y stack. Playwright's recommended CI pattern: separate workflow with `playwright install --with-deps`, sharded execution.
(e) Argos has Playwright installed but no CI workflow runs it. E2E coverage is local-only.
(f) **ADD** `e2e.yml` triggered on `pull_request` paths matching `src/routes/**` or `src/lib/components/**`. Use `--shard=${{ matrix.shard }}/4` matrix. Mark non-blocking initially (warn) until baseline is stable — same hold-the-line philosophy as trunk.

### 3.10 Danger.js

(a) Per-PR Dangerfile that posts comments / fails based on PR shape.
(b) https://danger.systems/js/
(c) `danger@13.0.7` + `dangerfile.js`. Rules: 1200-line cap (excludes generated globs), cross-subsystem sprawl warning, tests-required for `src/lib/server/**`, migration-drift warning. Workflow: `danger.yml` runs `npx danger ci --failOnErrors` per PR.
(d) Danger is the standard for "PR-shape" rules that don't fit into ESLint or commit-msg. From the docs: _"Danger runs during your CI process, and gives teams the chance to automate common code review chores."_
(e) Argos's Dangerfile is well-engineered and load-bearing. Memory `project_argos_danger_pr_shape_gates.md` confirms the 1200-line cap is real and forces PR splits.
(f) Keep as-is. Consider adding a `release-notes` rule: warn if a `feat`/`fix` commit lands without a CHANGELOG entry — but semantic-release auto-generates the changelog from commit messages, so this is redundant.

### 3.11 Trunk.io / @trunkio/launcher

(a) Multi-linter aggregator + hold-the-line gate.
(b) https://docs.trunk.io/code-quality
(c) `@trunkio/launcher@1.3.4`. `.trunk/trunk.yaml` enables 10 linters (actionlint, gitleaks, markdownlint, prettier, renovate, ruff, shellcheck, svgo, taplo, yamllint). Pre-commit invokes `trunk check --index`. CI invokes `trunk check --upstream=origin/main` (informational only, `|| true`).
(d) Trunk's docs (https://docs.trunk.io/code-quality): _"trunk check … is git-aware and checks only files you changed"_ and hold-the-line means _"only new changes instead of every existing issue."_
(e) **Real overlap**: trunk's prettier and gitleaks duplicate the standalone prettier+gitleaks gates. trunk's actionlint/markdownlint/yamllint/ruff/shellcheck have no other owner — trunk is the **only** enforcement point. Memory `feedback_trunk_autofix_pollution.md` documents trunk auto-staging collateral fixes, polluting commit scope.
(f) **KEEP trunk** — it's the owner of 5 linters with no alternative (actionlint, markdownlint, yamllint, shellcheck, taplo). Reconcile prettier config drift between `.trunk/configs/.prettierrc.yaml` and root `.prettierrc` so trunk and lint-staged produce identical output. Disable trunk's prettier/gitleaks (already-disabled list pattern) once standalone gates are confirmed equivalent.

### 3.12 gitleaks

(a) Secret scanner.
(b) https://github.com/gitleaks/gitleaks
(c) Runs in CI via `gitleaks/gitleaks-action@v2.3.9` in `lint.yml`. Pre-commit has a hand-rolled regex secret scan (faster, narrower).
(d) Standard secret-scanning tool. Pre-commit + CI dual-layer is correct (per defense-in-depth principle).
(e) Pre-commit regex covers AWS, GH, Slack, PEM, Anthropic, OpenAI, Stripe, GCP, JWT — narrower than gitleaks default ruleset but fast (no binary download).
(f) Keep both. The pre-commit regex is the fast-fail; gitleaks-action is the full-history backstop on PRs.

### 3.13 CodeRabbit

(a) AI code-review service that comments on every PR.
(b) https://docs.coderabbit.ai/
(c) Active on argos-jetson. Memory `project_review_workflow.md`: _"feature→dev auto-merge via CodeRabbit + coderabbit:autofix loop; main merge stays manual."_
(d) Mainstream alternatives in 2026: CodiumAI/Qodo, GitHub Copilot Workspace review, Diffblue Cover (Java only), Greptile. CodeRabbit is the most mature for full-PR code review with line-level comments + summarization.
(e) CodeRabbit is the only review layer (no human reviewers). Cost is ~$15-30/dev/month tier; Argos is solo so this is bounded.
(f) Keep CodeRabbit. Do **not** double-up with CodiumAI/Greptile — diminishing returns and PR comment noise.

### 3.14 GitHub Actions (caching, workflow_call, matrix)

(a) Hosted CI; `actions/cache@v4` for arbitrary caches; `setup-node@v4+` for built-in npm/pnpm/yarn cache; `workflow_call` for reusable workflows; matrix for parallelism.
(b) https://docs.github.com/en/actions
(c) Argos uses `actions/setup-node@v4` with `cache: 'npm'` (built-in lockfile-keyed) plus a separate `actions/cache@v4` for `.eslintcache`. SHA-pinned actions. `concurrency` group + `cancel-in-progress: true` on PR workflows. Release workflow disables cancellation.
(d) From the actions/cache README (https://github.com/actions/cache/blob/main/README.md): _"The cache is scoped to the key, version, and branch. The default branch cache is available to other branches."_ Best practice: setup-node's built-in cache for node_modules; separate `actions/cache` for tool-specific caches (eslint, vitest).
(e) Configuration is correct. SHA-pinning is exemplary. One nit: setup-node@v4 is end-of-life; v5+ enables caching by default and v6 requires `devEngines.packageManager`.
(f) **UPGRADE** to `actions/setup-node@v5` (Renovate handles pin bumps). Keep `cache: 'npm'` explicit — v6 changed the default. Keep `actions/cache@v4` for `.eslintcache` and add one for `.vitest-cache` and `node_modules/.cache/svelte-check` if measured savings exceed 10 s.

### 3.15 Sentrux

(a) Architecture quality gate. Walks the dependency graph and produces `quality_signal` score + cycle/layer detection.
(b) Internal MCP (configured per `CLAUDE.md` Rule 6). Day-0 baseline: 5401. Current `quality_signal` and per-PR delta history are tracked in memory `project_sentrux_baseline.md` + `project_sentrux_day0_complete.md` (single source of truth — hard-coded values omitted from this spec to avoid drift).
(c) Per-PR session bracketing: `session_start` after branch creation, `rescan` + `session_end` + `check_rules` before merge. `quality_signal` MUST NOT regress.
(d) Sentrux is internal — no public canon. The bracketing pattern is documented in `feedback_sentrux_per_pr_session.md`.
(e) Not currently a CI step — runs only via the per-PR Claude session. Risk: a `--no-verify` push that lands without sentrux bracketing degrades the score silently.
(f) **OPTIONAL**: add `sentrux.yml` workflow that runs `sentrux scan` + `check_rules` on PRs and posts the delta as a PR comment. Block merge on regression. Defer until sentrux ships a stable CLI mode for CI.

### 3.16 Husky alternatives (lefthook, simple-git-hooks, pre-commit framework)

(a) **lefthook**: Go binary, parallel jobs, `stage_fixed` (auto-stage fixes). **simple-git-hooks**: zero-dep, ~11 kB, config-in-package.json. **pre-commit framework**: Python, polyglot, language-aware runtime isolation.
(b) https://lefthook.dev/ ; https://github.com/toplenboren/simple-git-hooks ; https://pre-commit.com/
(c) None installed.
(d) When each wins:

- **lefthook** > husky if you need true parallelism (Argos's pre-commit is sequential by design — secret scan must finish before lint-staged) and `stage_fixed` (Argos uses lint-staged's auto-stage already).
- **simple-git-hooks** > husky for tiny repos with trivial hooks (Vue.js core's bar). Argos's hooks are too rich.
- **pre-commit framework** > husky for polyglot repos that need language-isolated hook runtimes. Argos is JS-primary with one Python tool (ruff) handled inline; not the use case.
  (e) None.
  (f) **STAY ON HUSKY**. lefthook would shave ~50 ms; simple-git-hooks would force config-in-package.json which conflicts with mem-guard wrapping; pre-commit is the wrong runtime model.

---

## 4. Edge Case Handling

### 4.1 Cold-start fresh worktree

Symptom: typecheck ~150 s + ESLint ~90 s + vitest related ~60 s ≈ 5+ minutes on first push, breaching the agent-runtime 180 s SIGTERM ceiling.

Mitigation (all in place):

- ESLint cache (`.eslintcache`, `--cache-strategy content`) — survives `git checkout`.
- mem-guard tier (RAM-aware heap sizing) — see memory `project_memguard_ram_tiering.md`.
- Bypass ladder: `SKIP_TESTS=1`, `SKIP_FULL_LINT=1`. CI is the safety net.
- `vitest related` (file-scoped) — but this is the section being dropped per §3.8.

Recommended fresh-worktree script (NEW):

```bash
# scripts/dev/warm-caches.sh
ln -sf ../../node_modules .  # if worktree
npm run typecheck             # populates .svelte-kit + tsbuildinfo
npx eslint . --config config/eslint.config.js --cache --cache-location .eslintcache
```

### 4.2 Agent-runtime 180 s subprocess SIGTERM

Symptom: Claude Code SIGTERMs background subprocesses at ~3 min, killing pre-push tests.

Mitigation: `SKIP_TESTS=1 git push` is the **sanctioned** bypass per memory `feedback_skip_tests_sanctioned_bypass.md`. Once vitest is dropped from pre-push (§3.8), this bypass becomes unnecessary for the test gate. Typecheck (~150 s) remains under the ceiling on warm cache; ESLint with cache is ~5 s.

### 4.3 Multi-worktree concurrency (6-10 worktrees)

Symptom: parallel `npm run typecheck` invocations OOM the system (svelte-check ~650 MB × N).

Mitigation (in place): `scripts/ops/mem-guard.sh` uses `flock` (kernel-atomic single global lock). Per memory `feedback_mem_guard_authoritative.md`, **always** use `npm run test:*` and `npm run typecheck` (which wrap mem-guard); never invoke `npx vitest` or `npx svelte-check` directly.

### 4.4 Native addons (better-sqlite3, node-pty)

Symptom: native addons in `devDependencies` get bundled into ESM server chunk → `ReferenceError: __filename is not defined`.

Mitigation (in place): both addons are in `dependencies` per `CLAUDE.md`. CI's `npm ci` step honors the dependency split. Release workflow's `npm ci --omit=dev` strips devDependencies but keeps the natives.

---

## 5. Authoritative Gate Matrix

Each gate has exactly one canonical owner. Redundant copies are listed for removal.

| Gate                      | Canonical owner               | Local mirror                         | Redundant copies to remove                            |
| ------------------------- | ----------------------------- | ------------------------------------ | ----------------------------------------------------- |
| ESLint full-repo          | `lint.yml` (cached)           | `pre-push`                           | `ci.yml` `npm run lint` step (PR-CI-3 already opened) |
| ESLint staged-only        | `pre-commit` (lint-staged)    | —                                    | —                                                     |
| svelte-check / typecheck  | `ci.yml`                      | `pre-push`                           | none                                                  |
| Vitest full suite         | `ci.yml` `test_unit`          | —                                    | `pre-push` vitest stage (PR-CI-5 in flight)           |
| Prettier check            | `ci.yml` `format:check`       | `pre-commit` (lint-staged)           | trunk's prettier (disable in `.trunk/trunk.yaml`)     |
| Conventional Commits      | `lint.yml` `commitlint`       | `pre-commit` (commit-msg)            | `commitlint.yml` (PR-CI-2 already opened)             |
| Secret scan (regex)       | `pre-commit`                  | —                                    | —                                                     |
| Secret scan (full)        | `lint.yml` `gitleaks`         | —                                    | trunk's gitleaks (disable in `.trunk/trunk.yaml`)     |
| Production build          | `ci.yml`                      | —                                    | none                                                  |
| Audit-delta (npm audit)   | `ci.yml`                      | —                                    | none                                                  |
| PR shape (size, sprawl)   | `danger.yml`                  | —                                    | none                                                  |
| Multi-linter (yaml/sh/md) | `trunk.yml` + `pre-commit`    | `pre-commit` (`trunk check --index`) | none                                                  |
| Architecture quality      | sentrux per-PR session        | —                                    | none                                                  |
| AI code review            | CodeRabbit                    | —                                    | none                                                  |
| Tag release               | `release.yml` (on `v*.*.*`)   | —                                    | none                                                  |
| Auto-version + changelog  | `semantic-release.yml` (main) | —                                    | none                                                  |

---

## 6. Migration Roadmap

Ordered by leverage. PRs already in flight noted.

1. **PR-CI-2** (open #72) — drop `commitlint.yml`; commitlint runs only in `lint.yml`.
2. **PR-CI-3** (open #73) — drop `npm run lint` from `ci.yml` (covered by `lint.yml`).
3. **PR-CI-5** (in flight) — drop vitest from `pre-push`; tests run only in CI.
4. **NEW** — Add `lint-staged.config.mjs` per §3.2. Critical hidden bug — pre-commit currently no-ops on lint-staged.
5. **NEW** — Replace `.husky/commit-msg` regex with `npx --no-install commitlint --edit "$1"`. Single-source from `commitlint.config.mjs`.
6. **NEW** — Disable prettier + gitleaks in `.trunk/trunk.yaml` (already-disabled list pattern). Remove the format-drift risk between trunk's and root's prettier configs.
7. **NEW** — Add `e2e.yml` with sharded Playwright on PR (warn-only initially).
8. **NEW** — Bump `actions/setup-node@v4` → `@v5` via Renovate.
9. **NEW** — Add `scripts/dev/warm-caches.sh` for fresh-worktree onboarding.
10. **OPTIONAL** — Add `sentrux.yml` once sentrux ships a stable CI mode.

---

## Appendix A — Decision Log

### A.1 Husky vs lefthook vs simple-git-hooks vs pre-commit framework

**Question**: which git-hooks runner is right for Argos?
**Decision**: **husky@9**.
**Citations**:

- Husky's lightweight default + POSIX-shell flexibility (https://typicode.github.io/husky/) accommodates Argos's mem-guard wrapper, Python ruff gate, and hand-rolled secret-scan regex.
- simple-git-hooks (https://github.com/toplenboren/simple-git-hooks) requires single-line config in `package.json`; cannot express the 5-stage Argos pre-commit chain without extracting to a separate script (defeating the size advantage).
- lefthook (https://lefthook.dev/) wins for parallel hooks. Argos's pre-commit is sequential by design (secret scan must complete before files are read by lint-staged); lefthook's parallelism doesn't apply.
- pre-commit (https://pre-commit.com/) is for polyglot repos with language-isolated runtimes. Argos is JS-primary; ruff is the only Python tool and is invoked inline.
  **Rejected**: all alternatives.

### A.2 Trunk.io: keep or drop?

**Question**: trunk overlaps husky pre-commit and `lint.yml`. Worth keeping?
**Decision**: **keep, but narrow scope**.
**Citations**: trunk owns 5 linters with no other home (actionlint, markdownlint, yamllint, shellcheck, taplo). No competing aggregator with the same hold-the-line semantics (https://docs.trunk.io/code-quality: _"only new changes instead of every existing issue"_).
**Rejected**: drop trunk entirely (loses 5 linters), or replace with per-linter GH Actions (multiplies workflow complexity 5×).

### A.3 CodeRabbit vs alternatives

**Question**: CodeRabbit is paid; cheaper alternatives exist.
**Decision**: **keep CodeRabbit**.
**Citations**: solo developer (no human review layer). CodiumAI/Qodo and Greptile have similar feature parity; switching cost > savings. Copilot Workspace review is gated behind GH Enterprise.
**Rejected**: dropping AI review entirely (Argos has no human reviewers; this is the only review gate); switching to CodiumAI (no measurable advantage).

### A.4 Pre-push tests: full suite vs `--changed` vs `related` vs none

**Question**: should pre-push run any tests?
**Decision**: **none**. Tests run in CI (`ci.yml`) only.
**Citations**:

- Vue.js core (https://github.com/vuejs/core/blob/main/package.json): pre-commit runs `pnpm lint-staged && pnpm check`; **no pre-push hook**, **no tests pre-commit**.
- Svelte core (https://github.com/sveltejs/svelte/blob/main/package.json): no `husky` dep, no pre-push, no pre-commit hook of any kind.
- SvelteKit (https://github.com/sveltejs/kit/blob/main/package.json): `precommit` script (manual), no auto-hook.
- Microsoft TypeScript: `setup-hooks` is opt-in symlink; no pre-push.
- Carbon Components Svelte: `biome check --write` only; no test hook.
- Vitest's own docs (https://vitest.dev/guide/cli.html) recommend `vitest related --run` only for **lint-staged**, not pre-push.
- Argos memory `feedback_skip_tests_sanctioned_bypass.md` documents `SKIP_TESTS=1` as routine.
  **Rejected**:
- Full suite (~3+ min, exceeds agent-runtime ceiling).
- `--changed` (the run-related-tests.sh comment correctly notes that `package.json` in diff balloons to full suite).
- `related` (current state) — the right primitive but the wrong gate; CI owns this.

### A.5 ESLint plugins — which pull weight?

**Question**: keep all 6 plugins or trim?
**Decision**: **keep all 6 pending audit of actual rule coverage**.
**Citations**:

- `@typescript-eslint` — required for any TS project.
- `eslint-plugin-svelte` — required for `.svelte` parsing.
- `eslint-config-prettier` — required to disable conflicting rules (https://prettier.io/docs/install: _"It turns off all ESLint rules that are unnecessary or might conflict with Prettier."_).
- `eslint-plugin-sonarjs` — provides cognitive-complexity rule that Argos enforces at ≤5 (verified in `pre-push` hook comment).
- `eslint-plugin-boundaries` — overlaps with sentrux's layer enforcement. Audit which is authoritative; drop the loser.
- `eslint-plugin-simple-import-sort` — prevents merge conflicts in import lists. Cheap; keep.
  **Rejected**: dropping any until rule-coverage audit confirms inactive plugin.

---

## Appendix B — Sources

All canonical sources cited inline above. Aggregated for one-stop navigation:

- Husky: https://typicode.github.io/husky/ , https://typicode.github.io/husky/how-to.html
- lint-staged: https://github.com/lint-staged/lint-staged/blob/main/README.md
- Conventional Commits 1.0: https://www.conventionalcommits.org/en/v1.0.0/
- commitlint: https://commitlint.js.org/
- wagoid/commitlint-github-action: https://github.com/wagoid/commitlint-github-action
- ESLint v9 flat config: https://eslint.org/docs/latest/use/configure/configuration-files
- Prettier: https://prettier.io/docs/install
- svelte-check: https://www.npmjs.com/package/svelte-check
- Vitest CLI: https://vitest.dev/guide/cli.html
- Playwright: https://playwright.dev/docs/ci
- @axe-core/playwright: https://www.npmjs.com/package/@axe-core/playwright
- Danger.js: https://danger.systems/js/
- Trunk.io: https://docs.trunk.io/code-quality
- gitleaks: https://github.com/gitleaks/gitleaks
- CodeRabbit: https://docs.coderabbit.ai/
- actions/cache@v4: https://github.com/actions/cache/blob/main/README.md
- actions/setup-node: https://github.com/actions/setup-node/blob/main/README.md
- lefthook: https://lefthook.dev/
- simple-git-hooks: https://github.com/toplenboren/simple-git-hooks
- pre-commit framework: https://pre-commit.com/

Reference repositories surveyed (for canon-by-popularity):

- vuejs/core (`simple-git-hooks` + `lint-staged` + `pnpm check` in pre-commit; no pre-push)
- sveltejs/svelte (no git hooks; CI-only)
- sveltejs/kit (manual `precommit` script; no auto-hook)
- microsoft/TypeScript (opt-in `setup-hooks`; no auto-hook)
- vercel/next.js (`husky` + `lint-staged`; no pre-push tests)
- carbon-design-system/carbon-components-svelte (biome only; no git hooks)
