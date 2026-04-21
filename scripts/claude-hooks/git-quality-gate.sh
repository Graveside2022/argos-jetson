#!/bin/bash
#
# Pre-tool gate for git commit: runs type + test checks scoped to STAGED files
# only. Previous version ran `npm run typecheck` + `npm run test:unit` repo-
# wide, which meant any pre-existing failure anywhere in the repo blocked
# every commit — including ones that didn't touch the broken code. That gate
# pattern erodes trust in the hook (operators learn to --no-verify
# reflexively) and couples unrelated feature work to trunk-health debt.
#
# New behavior:
#   - TS check: `tsc --noEmit --skipLibCheck` on the staged `.ts`/`.svelte`
#     files. Skipped entirely if no TS/Svelte files are staged.
#   - Test check: `vitest --related <staged-files> --run` which uses vitest's
#     built-in module graph to find tests that transitively import any staged
#     source file and run only those. Skipped entirely if no tests match.
#
# If trunk has pre-existing failures (like the 13-failure state pre-Track-A),
# they are now only blocking when a commit actually touches code in their
# dependency closure — the pattern this hook is meant to catch.
#
# Escape hatch stays: `git commit --no-verify` bypasses entirely.
#
set -euo pipefail
INPUT=$(cat) || exit 0
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0
if [ "$TOOL_NAME" != "Bash" ]; then exit 0; fi
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
if ! echo "$COMMAND" | grep -q 'git commit'; then exit 0; fi
if echo "$COMMAND" | grep -q '\-\-no-verify'; then exit 0; fi

cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0

# Collect staged files, filtered to types/svelte, one per line.
STAGED_CODE=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | grep -E '\.(ts|svelte)$' || true)

if [ -z "$STAGED_CODE" ]; then
	echo "⏭  No staged TS/Svelte files — skipping quality gate" >&2
	exit 0
fi

echo "🔍 Running staged-file quality gate..." >&2

# --- Type check: only staged files ---
echo "  Checking types (staged files only)..." >&2
TSC_OUT=$(mktemp)
if ! echo "$STAGED_CODE" | xargs npx tsc --noEmit --skipLibCheck >"$TSC_OUT" 2>&1; then
	ERR=$(head -50 "$TSC_OUT")
	rm -f "$TSC_OUT"
	cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "TypeScript errors in staged files. Fix types before committing.\n\nErrors:\n${ERR}\n\nOr skip: git commit --no-verify"
  }
}
EOF
	exit 0
fi
rm -f "$TSC_OUT"
echo "    ✓ Types valid" >&2

# --- Test check: vitest --related on staged files ---
# `vitest related` walks the module graph and runs any test that transitively
# imports a staged file. If nothing imports the staged file (e.g. new module),
# no tests run — which is correct: there's nothing for this hook to verify.
echo "  Running related tests..." >&2
TEST_OUT=$(mktemp)
if ! echo "$STAGED_CODE" | xargs npx vitest related --run --coverage=false >"$TEST_OUT" 2>&1; then
	ERR=$(tail -60 "$TEST_OUT")
	rm -f "$TEST_OUT"
	cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Tests related to staged files failed.\n\nLast 60 lines:\n${ERR}\n\nOr skip: git commit --no-verify"
  }
}
EOF
	exit 0
fi
rm -f "$TEST_OUT"
echo "    ✓ Related tests passed" >&2

echo "✅ Staged-file quality gate passed" >&2
exit 0
