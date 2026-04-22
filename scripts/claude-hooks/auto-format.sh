#!/bin/bash
set -euo pipefail
# auto-format.sh — PostToolUse hook for Edit|Write
# Runs ESLint --fix + Prettier --write on the file Claude just touched.
# Guards: symlink bypass, project-dir scoping, lockfile mutex (DoS protection
# under Edit spam), npx availability.

LOCKFILE="/tmp/argos-autoformat.lock"

INPUT=$(cat) || exit 0
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

if [[ -z "$FILE_PATH" ]] || [[ ! -f "$FILE_PATH" ]] || [[ -L "$FILE_PATH" ]]; then exit 0; fi

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
FILE_EXT="${FILE_PATH##*.}"
case "$FILE_EXT" in
    js|ts|svelte)
        npx eslint --config config/eslint.config.js --fix "$FILE_PATH" 2>/dev/null || true
        npx prettier --write "$FILE_PATH" 2>/dev/null || true
        echo "✓ Formatted: $FILE_PATH" >&2
        ;;
    json|md|css|html)
        npx prettier --write "$FILE_PATH" 2>/dev/null || true
        echo "✓ Formatted: $FILE_PATH" >&2
        ;;
    *) ;;
esac
exit 0
