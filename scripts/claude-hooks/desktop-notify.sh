#!/bin/bash
set -euo pipefail
# desktop-notify.sh — Notification hook
# Current Notification input schema exposes only .message; urgency lives in
# the matcher (permission_prompt/idle_prompt/auth_success/elicitation_dialog).
# Uniform low-urgency toast is simpler than branching on a field that isn't
# part of the current schema.

INPUT=$(cat) || exit 0
MESSAGE=$(echo "$INPUT" | jq -r '.message // "Claude Code needs your attention"' 2>/dev/null)

if command -v notify-send >/dev/null 2>&1; then
    notify-send -u normal "Claude Code" "$MESSAGE" 2>/dev/null || true
fi
exit 0
