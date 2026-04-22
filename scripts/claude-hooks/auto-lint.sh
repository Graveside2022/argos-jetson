#!/bin/bash
set -euo pipefail
# auto-lint.sh — PostToolUse hook for Edit|Write
# Runs ESLint in report mode (no --fix) to surface complexity violations
# that auto-format.sh can't auto-fix. On complexity violations emits
# decision:"block" JSON so the model gets structured in-loop feedback.

LOCKFILE="/tmp/argos-autolint.lock"

INPUT=$(cat) || exit 0
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
if [[ -z "$FILE_PATH" ]]; then exit 0; fi
if ! echo "$FILE_PATH" | grep -qE '\.(ts|tsx|svelte|js)$'; then exit 0; fi
if [[ ! -f "$FILE_PATH" ]] || [[ -L "$FILE_PATH" ]]; then exit 0; fi

command -v npx >/dev/null 2>&1 || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
case "$FILE_PATH" in
    "$PROJECT_DIR"/*) ;;
    *) exit 0 ;;
esac

if [[ -f "$LOCKFILE" ]]; then
    LOCK_PID=$(cat "$LOCKFILE" 2>/dev/null)
    if [[ -n "$LOCK_PID" ]] && kill -0 "$LOCK_PID" 2>/dev/null; then
        exit 0
    fi
    rm -f "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

cd "$PROJECT_DIR" || exit 0

OUTPUT=$(npx eslint "$FILE_PATH" --config config/eslint.config.js --no-warn-ignored 2>&1)
EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
    ERRORS=$(echo "$OUTPUT" | grep -E '(error|complexity)' | head -10)
    if [[ -n "$ERRORS" ]]; then
        if echo "$ERRORS" | grep -qiE 'complexity|cognitive|sonarjs/cognitive'; then
            REASON="Complexity violation in $(basename "$FILE_PATH") — fix before next action:

$ERRORS"
            jq -n --arg reason "$REASON" \
                '{decision:"block",reason:$reason}'
            exit 0
        fi
        echo "Lint errors in $(basename "$FILE_PATH"):" >&2
        echo "$ERRORS" >&2
    fi
fi
exit 0
