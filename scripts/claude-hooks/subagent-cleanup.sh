#!/bin/bash
set -euo pipefail
# subagent-cleanup.sh — SubagentStop hook
# Kills orphan vitest/tsserver processes that were parented to a subagent shell
# which is now terminating. Guards against infinite stop-hook loops.

INPUT=$(cat 2>/dev/null) || true

STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
if [ "$STOP_ACTIVE" = "true" ]; then
    exit 0
fi

# Kill orphaned vitest workers (parent=init means their shell already died)
for pid in $(pgrep -f "vitest.*--reporter" 2>/dev/null || true); do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ "$ppid" = "1" ]; then
        kill "$pid" 2>/dev/null || true
    fi
done

# Kill orphaned tsserver instances (these leak heavily in subagent use)
for pid in $(pgrep -f "tsserver" 2>/dev/null || true); do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ "$ppid" = "1" ]; then
        kill "$pid" 2>/dev/null || true
    fi
done
exit 0
