#!/bin/bash
set -euo pipefail
# block-sensitive-files.sh — PreToolUse hook for Edit|Write
# Blocks edits to .env files, credentials, secrets.
# Emits JSON permissionDecision:deny via jq -n (never interpolates untrusted
# strings into heredoc — prevents JSON injection bypass).

INPUT=$(cat) || exit 0
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
if [ -z "$FILE_PATH" ]; then exit 0; fi

FILENAME=$(basename "$FILE_PATH")

# Widened .env matcher: covers .env, .env.LOCAL, .env.prod.test, .env-staging.
if echo "$FILENAME" | grep -qE '^\.(env|env[._-][A-Za-z0-9._-]+)$'; then
    case "$FILENAME" in
        .env.example|.env.template|.env.sample) exit 0 ;;
    esac
    REASON="BLOCKED: Editing sensitive file '$FILENAME'. This file contains secrets (API keys, tokens).

If you need to modify environment variables:
  1. Edit .env.example (safe, committed)
  2. Ask the user to manually update .env"
    jq -n \
        --arg reason "$REASON" \
        '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
    exit 0
fi

if echo "$FILENAME" | grep -qiE 'credentials|secrets|\.key$|\.pem$|\.p12$|\.pfx$|id_rsa|id_ed25519'; then
    REASON="BLOCKED: Editing credential/key file '$FILENAME'.

Never write secrets via Claude. Ask the user to manage this file manually."
    jq -n \
        --arg reason "$REASON" \
        '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
    exit 0
fi

exit 0
