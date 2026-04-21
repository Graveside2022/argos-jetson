#!/bin/bash
set -euo pipefail
INPUT=$(cat) || exit 0
LOG_DIR="$HOME/.claude/sessions"
mkdir -p "$LOG_DIR" 2>/dev/null || exit 0
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/${DATE}-audit.jsonl"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null)
SUCCESS_RAW=$(echo "$INPUT" | jq -r '.tool_response.success // true' 2>/dev/null)
case "$SUCCESS_RAW" in
    true|false) SUCCESS="$SUCCESS_RAW" ;;
    *) SUCCESS=true ;;
esac
case "$TOOL_NAME" in
    "Edit")  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null); ACTION="edited $FILE" ;;
    "Write") FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null); ACTION="created $FILE" ;;
    "Read")  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null); ACTION="read $FILE" ;;
    "Bash")  CMD=$(echo "$INPUT"  | jq -r '.tool_input.command // "unknown"'   2>/dev/null | head -c 160); ACTION="ran: $CMD" ;;
    "Agent") AGENT=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // "unknown"' 2>/dev/null); ACTION="spawned $AGENT agent" ;;
    *) ACTION="used $TOOL_NAME" ;;
esac
jq -c -n \
  --arg ts "$TIMESTAMP" \
  --arg tool "$TOOL_NAME" \
  --arg action "$ACTION" \
  --argjson success "$SUCCESS" \
  '{timestamp:$ts,tool:$tool,action:$action,success:$success}' >> "$LOG_FILE" 2>/dev/null
exit 0
