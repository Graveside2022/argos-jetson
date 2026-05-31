#!/bin/bash
# scripts/ops/mem-guard.sh
# Memory-safe wrapper for heavy dev commands (build, lint, typecheck, test).
#
# Two protections:
#   1. Pre-flight memory check — refuses to start if RAM > threshold
#   2. Concurrency lock — only one heavy command at a time
#
# Usage: ./scripts/ops/mem-guard.sh <command> [args...]
# Example: ./scripts/ops/mem-guard.sh npx vite build
#          ./scripts/ops/mem-guard.sh npx eslint src/
#
# Environment overrides:
#   MEM_GUARD_THRESHOLD=85   — percentage used above which command is blocked
#   MEM_GUARD_SKIP=1         — bypass all checks (CI environments)

set -euo pipefail

# --- Node memory ceiling (RAM-aware tiering) ---
# Different workloads have different memory profiles:
#   - svelte-check + vitest workers: ~650 MB each, OK with 1536
#   - vite build + adapter-node SSR bundle: peaks ~2.8 GB RSS, needs 3072+
# Solution: scale the heap cap to the host's actual RAM so the same
# mem-guard call works on RPi5 (8 GB) and Jetson AGX Orin (64 GB).
# Respect caller-provided NODE_OPTIONS overrides (specialized runs still win).
if [ -z "${NODE_OPTIONS:-}" ]; then
    _ram_mb=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
    if   [ "${_ram_mb:-0}" -ge 24000 ]; then _heap=4096     # Jetson AGX Orin (64 GB)
    elif [ "${_ram_mb:-0}" -ge 12000 ]; then _heap=3072     # Jetson Nano 16 GB / RPi5 16 GB
    elif [ "${_ram_mb:-0}" -ge  6000 ]; then _heap=2048     # RPi5 8 GB (primary target)
    else                                     _heap=1024     # minimal / edge devices
    fi
    export NODE_OPTIONS="--max-old-space-size=${_heap}"
    unset _ram_mb _heap
fi

# --- Configuration ---
THRESHOLD="${MEM_GUARD_THRESHOLD:-85}"
LOCKFILE="/tmp/argos-heavy-cmd.lock"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[0;90m'
RESET='\033[0m'

# --- Functions ---

mem_pct() {
    awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "%d", (t-a)*100/t}' /proc/meminfo 2>/dev/null
}

mem_available_mb() {
    awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo 2>/dev/null
}

acquire_lock() {
    # Use flock(1) for kernel-guaranteed atomic locking.
    # The lock is held on file descriptor 9 for the lifetime of this script.
    # On process exit (including SIGKILL), the kernel auto-releases the fd.
    # No stale lock files, no PID checking, no TOCTOU race conditions.
    #
    # The PID file (.pid) is a separate diagnostic file — not the lock itself.
    # It's written after the lock is acquired and read by blocked processes.
    exec 9>"$LOCKFILE"
    if ! flock -n 9; then
        # Another process holds the lock — read its PID from the sidecar file
        local lock_pid lock_cmd
        lock_pid=$(cat "${LOCKFILE}.pid" 2>/dev/null | tr -cd '0-9')
        if [[ -n "$lock_pid" ]]; then
            lock_cmd=$(ps -p "$lock_pid" -o args= 2>/dev/null | head -c 60) || lock_cmd="unknown"
            echo -e "${RED}Another heavy command is running:${RESET}"
            echo -e "  ${DIM}PID $lock_pid: $lock_cmd${RESET}"
            echo -e "${RED}Wait for it to finish, or: kill $lock_pid${RESET}"
        else
            echo -e "${RED}Another heavy command is running (PID unknown).${RESET}"
            echo -e "${RED}Check: ps aux | grep mem-guard${RESET}"
        fi
        return 1
    fi
    # Lock acquired — write PID to sidecar file for diagnostics
    echo $$ > "${LOCKFILE}.pid"
    trap 'rm -f "${LOCKFILE}.pid"' EXIT
    return 0
}

# --- Main ---

if [[ "${MEM_GUARD_SKIP:-0}" = "1" ]]; then
    exec "$@"
fi

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <command> [args...]"
    echo "Example: $0 npx vite build"
    exit 1
fi

# Step 1: Acquire concurrency lock
if ! acquire_lock; then
    exit 1
fi

# Step 2: Memory pre-check
MEM_PCT=$(mem_pct)
MEM_AVAIL=$(mem_available_mb)

if [[ "$MEM_PCT" -ge "$THRESHOLD" ]]; then
    echo -e "${RED}Memory at ${MEM_PCT}% (${MEM_AVAIL}MB available).${RESET}"
    echo -e "${RED}Threshold: ${THRESHOLD}%. Command blocked to prevent OOM.${RESET}"
    echo ""
    echo "Options:"
    echo "  1. Close VS Code / Chromium / other heavy apps"
    echo "  2. Kill MCP servers: pkill -f 'npm exec.*mcp'"
    echo "  3. Force run: MEM_GUARD_SKIP=1 $*"
    exit 1
fi

# Step 3: Run the command with memory status
echo -e "${GREEN}Memory: ${MEM_PCT}% used (${MEM_AVAIL}MB available) — threshold ${THRESHOLD}%${RESET}"
echo -e "${DIM}Running: $*${RESET}"
echo ""

"$@"
EXIT_CODE=$?

# Step 4: Post-run memory report
MEM_AFTER=$(mem_pct)
MEM_AVAIL_AFTER=$(mem_available_mb)
echo ""
echo -e "${DIM}Memory after: ${MEM_AFTER}% (${MEM_AVAIL_AFTER}MB available)${RESET}"

exit "$EXIT_CODE"
