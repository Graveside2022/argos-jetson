#!/usr/bin/env bash
# kill-dev.sh — terminate the worktree-local vite + its tmux session.
#
# Replaces the previous package.json one-liner which unconditionally killed
# anything listening on :5173 — taking down argos-final.service (systemd
# production) every time `npm run dev` was invoked from ANY directory.
#
# Now derives the port from the worktree (VITE_PORT env wins; else
# port-for-worktree.sh) and refuses to kill :5173 / :5174 while the
# corresponding systemd unit is active. Bypass with FORCE=1 only when
# the systemd unit is genuinely wedged.
#
# Bypass guard:  FORCE=1 npm run kill-dev

set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd -P)"

if [[ -n "${VITE_PORT:-}" ]]; then
	port="$VITE_PORT"
else
	port="$("$here/port-for-worktree.sh" 2>/dev/null || echo 5173)"
fi

# Systemd guard — refuse to kill production ports unless explicitly overridden.
declare -A SYSTEMD_OWNERS=( [5173]=argos-final.service [5174]=argos-dev.service )
unit="${SYSTEMD_OWNERS[$port]:-}"
if [[ -n "$unit" && "${FORCE:-0}" != "1" ]]; then
	if systemctl is-active --quiet "$unit" 2>/dev/null; then
		cat >&2 <<EOF
[kill-dev] ❌ refusing to kill :$port — $unit is active (systemd-managed).
[kill-dev]    Production service. Pick one:
[kill-dev]      sudo systemctl stop $unit          # graceful stop, restart later
[kill-dev]      FORCE=1 npm run kill-dev           # bypass this guard
EOF
		exit 1
	fi
fi

touch /tmp/argos-dev-restart.lock 2>/dev/null || true

session="argos-logs-$port"
if tmux kill-session -t "$session" 2>/dev/null; then
	echo "[kill-dev] killed tmux session: $session"
fi

pids="$(lsof -ti:"$port" 2>/dev/null || true)"
if [[ -n "$pids" ]]; then
	echo "[kill-dev] SIGTERM → :$port (PIDs: $(echo "$pids" | tr '\n' ' '))"
	echo "$pids" | xargs -r kill 2>/dev/null || true
	sleep 1
	pids="$(lsof -ti:"$port" 2>/dev/null || true)"
	if [[ -n "$pids" ]]; then
		echo "[kill-dev] SIGKILL → :$port (survivors: $(echo "$pids" | tr '\n' ' '))"
		echo "$pids" | xargs -r kill -9 2>/dev/null || true
	fi
fi

exit 0
