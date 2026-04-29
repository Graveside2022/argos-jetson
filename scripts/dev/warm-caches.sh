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

echo "[warm-caches] populating .eslintcache via cached eslint scan..."
npx eslint . --config config/eslint.config.js \
  --cache --cache-location .eslintcache --cache-strategy content \
  || echo "[warm-caches] (eslint had warnings/errors; cache still populated)"

echo "[warm-caches] ✓ caches warm. First push should complete in <130s."
