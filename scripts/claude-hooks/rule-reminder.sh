#!/bin/bash
set -euo pipefail
# rule-reminder.sh — UserPromptSubmit hook
# Conditionally inject CLAUDE.md rule reminders based on keywords in the prompt.
# Cheaper than dumping every rule into SessionStart; only surfaces when relevant.

INPUT=$(cat) || exit 0
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null)
if [[ -z "$PROMPT" ]]; then exit 0; fi

PROMPT_LC=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
REMINDERS=""

case "$PROMPT_LC" in
    *debug*|*investigate*|*troubleshoot*|*why\ is*|*why\ does*|*root\ cause*)
        REMINDERS+="[Rule] debug-methodology source-of-truth order: runtime > code > git > memory > graph > docs."$'\n'
        ;;
esac
case "$PROMPT_LC" in
    *frontend*|*ui\ *|*browser*|*render*|*component*|*page\ *)
        REMINDERS+="[Rule 1] Frontend bugs → use chrome-devtools MCP BEFORE speculative fixes (inspect DOM/console/network in the running app)."$'\n'
        ;;
esac
case "$PROMPT_LC" in
    *svelte*|*.svelte*)
        REMINDERS+="[Rule 3] Every .svelte edit: list-sections → get-documentation → svelte-autofixer (never send Svelte code without svelte-autofixer clean)."$'\n'
        ;;
esac
case "$PROMPT_LC" in
    *install*|*apt\ *|*dpkg*|*pip\ install*|*npm\ install*|*setup\ *|*provision*)
        REMINDERS+="[Rule 5/install-docs-gate] Install tasks fetch OFFICIAL docs via octocode/context7 FIRST — install-docs-gate hook will deny sudo/apt/npm install until marker is set."$'\n'
        ;;
esac
case "$PROMPT_LC" in
    *hackrf*|*grgsm*|*kismet*|*gps*|*sdr*|*spectrum*)
        REMINDERS+="[Hardware] hardware-check hook blocks conflicting processes; check API status (curl /api/hackrf/status) before new captures."$'\n'
        ;;
esac
case "$PROMPT_LC" in
    *library*|*framework*|*sdk*|*react*|*vue*|*next.js*|*prisma*)
        REMINDERS+="[Rule 5] Third-party library questions → context7 MCP (resolve-library-id → query-docs) BEFORE WebFetch."$'\n'
        ;;
esac

if [[ -n "$REMINDERS" ]]; then
    jq -n --arg ctx "$REMINDERS" \
        '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$ctx}}'
fi
exit 0
