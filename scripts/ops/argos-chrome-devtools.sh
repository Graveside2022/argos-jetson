#!/usr/bin/env bash
# argos-chrome-devtools.sh — keep a headless Chrome/Chromium alive with the
# DevTools remote-debugging endpoint on :9222.
#
# Why this ships with Argos (like mem-guard / oom-protect / wifi-resilience):
# the Argos web terminal runs Claude Code, whose chrome-devtools MCP server
# (browser automation, Lighthouse, page snapshots — a core Argos capability)
# REQUIRES a Chrome instance reachable at http://127.0.0.1:9222. Without a
# persistent endpoint, every session has to hand-launch Chrome. This service
# makes :9222 always-on and self-healing.
#
# Usage:
#   argos-chrome-devtools.sh start     # launch once (idempotent)
#   argos-chrome-devtools.sh monitor   # launch + supervise (systemd ExecStart)
#   argos-chrome-devtools.sh status    # report endpoint health
#
# Env overrides:
#   CDP_PORT          remote-debugging port (default 9222)
#   CHROME_BIN        chrome/chromium binary (auto-detected if unset)
#   CDP_PROFILE_DIR   user-data-dir (default /tmp/argos-cdp-9222)
#   CDP_POLL_SEC      monitor poll interval (default 15)

set -uo pipefail

CDP_PORT="${CDP_PORT:-9222}"
CDP_PROFILE_DIR="${CDP_PROFILE_DIR:-/tmp/argos-cdp-${CDP_PORT}}"
CDP_POLL_SEC="${CDP_POLL_SEC:-15}"

detect_chrome() {
  if [[ -n "${CHROME_BIN:-}" ]]; then echo "$CHROME_BIN"; return; fi
  for c in /snap/bin/chromium chromium chromium-browser \
           google-chrome google-chrome-stable /usr/bin/chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
  done
  echo ""
}

endpoint_up() {
  # /json/version returns 200 with a Browser field when CDP is live
  curl -sf --max-time 3 "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1
}

launch() {
  if endpoint_up; then return 0; fi
  local bin; bin="$(detect_chrome)"
  if [[ -z "$bin" ]]; then
    echo "[chrome-devtools] no chrome/chromium binary found" >&2
    return 1
  fi
  mkdir -p "$CDP_PROFILE_DIR"
  echo "[chrome-devtools] launching $bin headless on :${CDP_PORT}"
  # setsid so it survives the launcher; flags = headless, no sandbox (Jetson),
  # no gpu, dedicated profile, blank page. Logs to journal via stderr.
  setsid "$bin" \
    --headless=new \
    --remote-debugging-port="${CDP_PORT}" \
    --remote-debugging-address=127.0.0.1 \
    --no-sandbox --disable-gpu \
    --no-first-run --no-default-browser-check \
    --user-data-dir="$CDP_PROFILE_DIR" \
    about:blank </dev/null >/dev/null 2>&1 &
  disown || true
  # wait up to 30s for endpoint
  for _ in $(seq 1 30); do
    if endpoint_up; then echo "[chrome-devtools] :${CDP_PORT} up"; return 0; fi
    sleep 1
  done
  echo "[chrome-devtools] endpoint did not come up within 30s" >&2
  return 1
}

case "${1:-monitor}" in
  start)
    launch
    ;;
  status)
    if endpoint_up; then
      echo "[chrome-devtools] :${CDP_PORT} UP"
      curl -sf --max-time 3 "http://127.0.0.1:${CDP_PORT}/json/version" 2>/dev/null | head -c 200
      echo
    else
      echo "[chrome-devtools] :${CDP_PORT} DOWN"; exit 1
    fi
    ;;
  monitor)
    launch || true
    # supervise: relaunch if the endpoint dies (chrome crash / OOM kill)
    while true; do
      if ! endpoint_up; then
        echo "[chrome-devtools] endpoint down — relaunching"
        launch || true
      fi
      sleep "$CDP_POLL_SEC"
    done
    ;;
  *)
    echo "Usage: $0 {start|monitor|status}" >&2
    exit 1
    ;;
esac
