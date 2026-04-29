#!/usr/bin/env bash
# warm-caches.sh — populate per-worktree caches so the first push from a
# fresh worktree doesn't pay cold-cache costs (~150s typecheck + ~90s
# ESLint = >180s agent runtime SIGTERM).
#
# Run this once after cutting a new worktree, before your first push:
#   bash scripts/dev/warm-caches.sh
#
# Per docs/ci-cd-pipeline-spec.md §4.1 (cold-start fresh worktree
# mitigation). After PR-CI-5 dropped vitest from pre-push and PR-CI-1
# wired the eslint --cache flag, warm-cache pre-push is ~125s — well
# under the 180s agent runtime cap.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "[warm-caches] populating .svelte-kit + tsbuildinfo via npm run typecheck..."
npm run typecheck

echo "[warm-caches] populating .eslintcache via npm run lint (mem-guard wrapped)..."
# Per ESLint CLI docs (https://eslint.org/docs/latest/use/command-line-interface
# #exit-codes), exit codes have distinct semantics:
#   0  — no errors/warnings (cache fully populated)
#   1  — lint findings present (cache STILL populated; tolerable here)
#   2  — config / parse / runtime error (cache may NOT be populated; FATAL)
# CR PR #75 caught the prior version swallowing all exit codes including 2.
set +e
npm run lint
ESLINT_RC=$?
set -e
case "$ESLINT_RC" in
  0) echo "[warm-caches] ✓ eslint clean; cache fully populated" ;;
  1) echo "[warm-caches] (eslint reported lint findings; cache still populated — ok)" ;;
  *)
    echo "[warm-caches] ❌ eslint failed with exit $ESLINT_RC (config/parse error). Cache may be incomplete." >&2
    echo "[warm-caches]    Investigate: 'npm run lint' directly to see the error." >&2
    exit "$ESLINT_RC"
    ;;
esac

echo "[warm-caches] ✓ caches warm. First push should complete in <130s."
