#!/bin/bash
set -euo pipefail
INPUT=$(cat) || exit 0
NOTIF_TYPE=$(echo "$INPUT" | jq -r '.notification_type // "info"' 2>/dev/null)
MESSAGE=$(echo "$INPUT" | jq -r '.message // "Claude Code needs your attention"' 2>/dev/null)
if command -v notify-send >/dev/null 2>&1; then
    case "$NOTIF_TYPE" in
        error|critical) notify-send -u critical "Claude Code" "$MESSAGE" 2>/dev/null || true ;;
        warning) notify-send -u normal "Claude Code" "$MESSAGE" 2>/dev/null || true ;;
        *) notify-send -u low "Claude Code" "$MESSAGE" 2>/dev/null || true ;;
    esac
fi
if [ "$NOTIF_TYPE" = "critical" ] || [ "$NOTIF_TYPE" = "error" ]; then
    printf '\a' 2>/dev/null || true
fi
exit 0
