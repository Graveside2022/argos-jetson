#!/bin/bash
set -euo pipefail
# preserve-bg-state.sh — PreCompact hook (matcher: auto)
# Snapshot active project-relevant bg processes + recent dev-server log tail
# so the post-compaction agent knows what is still running.
# Supports memory: feedback_actively_monitor_bg_tasks.md

INPUT=$(cat 2>/dev/null) || true

ACTIVE=$(pgrep -af 'hackrf_|kismet|vitest|grgsm_|bluedragon|tshark|dumpcap|node build|argos-dev-monitor' 2>/dev/null | grep -v grep | head -20 || true)

DEV_LOG_TAIL=""
if [[ -f /tmp/argos-dev.log ]]; then
    DEV_LOG_TAIL=$(tail -8 /tmp/argos-dev.log 2>/dev/null || true)
fi

HACKRF_API_STATUS=""
if curl -s -f http://localhost:5173/api/health >/dev/null 2>&1; then
    HACKRF_API_STATUS=$(curl -s http://localhost:5173/api/hackrf/status 2>/dev/null | head -c 300 || true)
fi

# Only emit context if we have anything worth preserving
if [[ -z "$ACTIVE" ]] && [[ -z "$DEV_LOG_TAIL" ]] && [[ -z "$HACKRF_API_STATUS" ]]; then
    exit 0
fi

CTX="[PreCompact bg-state snapshot — $(date -u +%H:%M:%SZ)]

Running project-relevant processes:
${ACTIVE:-(none)}

/tmp/argos-dev.log (last 8 lines):
${DEV_LOG_TAIL:-(no log)}

/api/hackrf/status (truncated):
${HACKRF_API_STATUS:-(api not responding)}"

jq -n --arg ctx "$CTX" \
    '{hookSpecificOutput:{hookEventName:"PreCompact",additionalContext:$ctx}}'
exit 0
