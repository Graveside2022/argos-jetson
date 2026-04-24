#!/usr/bin/env bash
# Run vitest on just the tests affected by a given diff. Two modes:
#
#   staged   (default) — diff against the index (pre-commit context)
#   upstream           — diff against the branch's upstream tracking ref
#                        (pre-push context: "what's about to be pushed")
#
# Called via npm scripts:
#   test:unit:related           → staged mode
#   test:unit:related:upstream  → upstream mode
#
# Both wrap this in scripts/ops/mem-guard.sh for concurrency + memory safety.
#
# `vitest run --changed HEAD` was rejected: when package.json is in the diff,
# --changed treats every test as affected and runs the full suite.
# `vitest related` is the precise primitive.
set -euo pipefail

mode="${1:-staged}"

case "$mode" in
    staged)
        files=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null \
            | grep -E '\.(js|ts|svelte|svelte\.ts)$' \
            || true)
        ;;
    upstream)
        upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "")
        if [ -z "$upstream" ]; then
            echo "[test:unit:related] no upstream tracking ref — falling back to full unit suite"
            exec npx vitest run src/ tests/unit --passWithNoTests
        fi
        files=$(git diff --name-only --diff-filter=ACMR "$upstream" HEAD 2>/dev/null \
            | grep -E '\.(js|ts|svelte|svelte\.ts)$' \
            || true)
        ;;
    *)
        echo "[test:unit:related] unknown mode: $mode (expected: staged | upstream)" >&2
        exit 2
        ;;
esac

if [ -z "$files" ]; then
    echo "[test:unit:related] no relevant $mode files — skipping"
    exit 0
fi

echo "[test:unit:related] scoping ($mode) to files:"
echo "$files" | sed 's/^/  /'

# shellcheck disable=SC2086
exec npx vitest run related $files --passWithNoTests
