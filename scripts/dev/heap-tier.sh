#!/bin/bash
# scripts/dev/heap-tier.sh
# Set NODE_OPTIONS to a RAM-tiered max-old-space-size, then exec the command.
#
# Same tiering as scripts/ops/mem-guard.sh:20-35 but WITHOUT the flock that
# mem-guard uses for serializing heavy commands. Long-running dev servers
# don't need (or want) the heavy-command lock — holding it for hours blocks
# every commit and every test run for the duration of the dev session.
#
# Use this for: dev servers, watchers, long-running tools that need a sized
# heap but should NOT serialize against build/test/typecheck flock.
# Use scripts/ops/mem-guard.sh instead for: build, typecheck, test runs.
#
# Respect caller-provided NODE_OPTIONS (specialized runs still win).
set -euo pipefail

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

exec "$@"
