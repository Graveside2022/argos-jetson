#!/usr/bin/env bash
# dev-start.sh — entry point for `npm run dev`.
#
# Replaces the previous 200-char one-liner in package.json. Each step is
# named so transcripts and `set -x` traces stay auditable.
#
# Steps (run in order, halts on first failure):
#   1. kill-dev      — clean up any prior vite / tmux on this worktree's port.
#                      Refuses to kill argos-final / argos-dev systemd units
#                      unless FORCE=1.
#   2. resolve port  — VITE_PORT env override wins; else port-for-worktree.sh.
#   3. launch vite   — backgrounded inside a tmux session (`argos-logs-<port>`),
#                      tee'd to /tmp/argos-dev-<port>.log. NO_TMUX=1 runs in
#                      the foreground instead (useful for IDE debug).
#   4. health check  — confirm the port is bound after the boot delay.
#
# Bypass kill-dev guard:  FORCE=1 npm run dev
# Override port:          VITE_PORT=5197 npm run dev
# Foreground vite:        NO_TMUX=1 npm run dev
#
# `npm run dev -- --port X` does NOT propagate because npm strips post-`--`
# args before lifecycle script evaluation. Use VITE_PORT=X instead.

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd -P)"

# Step 1
npm run kill-dev

# Step 2
if [[ -n "${VITE_PORT:-}" ]]; then
	port="$VITE_PORT"
	echo "[dev-start] VITE_PORT=$port (env override; port-for-worktree.sh skipped)"
else
	port="$("$here/port-for-worktree.sh")"
fi
export VITE_PORT="$port"

log="/tmp/argos-dev-$port.log"

# Step 3
if [[ "${NO_TMUX:-0}" = "1" ]]; then
	echo "[dev-start] NO_TMUX=1 — vite in foreground (logs to stdout)"
	exec "$here/start-vite.sh"
fi

session="argos-logs-$port"
# tmux does not inherit env vars by default — pass VITE_PORT explicitly via -e
# so start-vite.sh sees the override instead of falling through to
# port-for-worktree.sh.
tmux new-session -d -s "$session" -e "VITE_PORT=$port" "$here/start-vite.sh 2>&1 | tee $log"
rm -f /tmp/argos-dev-restart.lock

echo "[dev-start] vite launched in tmux session: $session (port :$port)"
echo "[dev-start] attach: tmux attach -t $session"
echo "[dev-start] tail:   tail -f $log"

# Step 4
sleep 6
if lsof -ti:"$port" >/dev/null 2>&1; then
	echo "[dev-start] ✓ vite UP on :$port"
else
	echo "[dev-start] ⚠ vite may still be starting (port :$port not yet bound)" >&2
fi
