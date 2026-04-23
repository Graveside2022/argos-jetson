#!/bin/bash
# Argos Claude Code quality gate — runs typecheck + test:unit before allowing
# Claude to invoke `git commit`. Long-running stages emit a heartbeat every
# 30s so silent runs don't look like a hang. Failing-stage output is replayed
# to stderr so Claude sees why the gate denied the commit.
set -euo pipefail
INPUT=$(cat) || exit 0
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name' 2>/dev/null) || exit 0
if [ "$TOOL_NAME" != "Bash" ]; then exit 0; fi
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
if ! echo "$COMMAND" | grep -q 'git commit'; then exit 0; fi
if echo "$COMMAND" | grep -q '\-\-no-verify'; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0

# Heartbeat helper: run a command with a "still running (Ns elapsed)" line
# every 30s. Captures output to a temp file so failures can be replayed.
run_with_heartbeat() {
    local label=$1; shift
    local start; start=$(date +%s)
    local log="/tmp/argos-gate-$$-${label//[^a-zA-Z0-9]/_}.log"
    echo "⏱  $label (started)" >&2
    "$@" >"$log" 2>&1 &
    local pid=$!
    while kill -0 "$pid" 2>/dev/null; do
        sleep 30
        if kill -0 "$pid" 2>/dev/null; then
            echo "  ⏱  $label still running ($(($(date +%s)-start))s elapsed)..." >&2
        fi
    done
    wait "$pid"
    local rc=$?
    local elapsed=$(($(date +%s)-start))
    if [ "$rc" -ne 0 ]; then
        echo "  ✗ $label FAILED in ${elapsed}s (exit=$rc) — output:" >&2
        sed 's/^/      /' "$log" >&2
    else
        echo "  ✓ $label done in ${elapsed}s" >&2
    fi
    rm -f "$log"
    return "$rc"
}

echo "🔍 Running pre-commit checks..." >&2

if ! run_with_heartbeat "typecheck" npm run typecheck; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "TypeScript errors detected. Fix types before committing.\n\nRun: npm run typecheck\n\nOr skip: git commit --no-verify"
  }
}
EOF
    exit 0
fi

if ! run_with_heartbeat "test:unit:related" npm run test:unit:related; then
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Unit tests failed. Fix tests before committing.\n\nRun: npm run test:unit:related\n\nFor a full-suite run: npm run test:unit\n\nOr skip: git commit --no-verify"
  }
}
EOF
    exit 0
fi

echo "✅ Pre-commit checks passed" >&2
exit 0
