#!/usr/bin/env bash
# Run vitest on just the tests affected by the currently-staged diff.
# Called by the `test:unit:related` npm script (which wraps it in
# scripts/ops/mem-guard.sh for concurrency + memory safety).
#
# Strategy:
#   1. Ask git for staged, relevant source files (.js/.ts/.svelte).
#   2. If none, exit 0 — nothing to verify that touches code paths.
#   3. Otherwise `vitest run related <files>` which traces imports and
#      runs only tests that transitively depend on the given files.
#
# The plain `vitest run --changed HEAD` alternative was tried and rejected:
# when package.json is staged, vitest's --changed heuristic treats every
# test as affected and runs the full 516-test suite, defeating the speedup.
# `vitest related` is the precise primitive.
set -euo pipefail

# --diff-filter=ACMR = Added, Copied, Modified, Renamed (ignore deletions).
files=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null \
    | grep -E '\.(js|ts|svelte|svelte\.ts)$' \
    || true)

if [ -z "$files" ]; then
    echo "[test:unit:related] no relevant staged files — skipping"
    exit 0
fi

echo "[test:unit:related] scoping to staged files:"
echo "$files" | sed 's/^/  /'

# `vitest run related` accepts a space-separated list of files.
# shellcheck disable=SC2086
exec npx vitest run related $files --passWithNoTests
