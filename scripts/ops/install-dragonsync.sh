#!/usr/bin/env bash
# Install DragonSync + droneid-go + wardragon-fpv-detect for Argos UAS tile.
#
# Idempotent — safe to re-run. Installs on the current host (auto-detects user).
# Does NOT start or enable the UAS scanner/fusion services; the operator starts
# them via the UAS panel's Start button (POST /api/dragonsync/control).
# wardragon-monitor is the one exception — it's enabled-now by _units.sh as a
# passive telemetry publisher.
#
# Structure (each module <300 LOC per CLAUDE.md Code Conventions):
#   scripts/ops/dragonsync/_deps.sh   — apt deps, libzmq, gr-inspector, clone,
#                                        bands patcher, config.ini, droneid-go
#                                        binary. Exports DRONEID_BIN, DRONEID_OK.
#   scripts/ops/dragonsync/_units.sh  — systemd unit generation for all 5 UAS
#                                        services (zmq-decoder, dragonsync,
#                                        wardragon-fpv-detect, argos-c2-scanner,
#                                        wardragon-monitor).
#   scripts/ops/dragonsync/_post.sh   — sudoers drop-in + UHD kernel tuning +
#                                        Jetson nvpmodel/jetson_clocks.
#
# Usage:
#   sudo ./scripts/ops/install-dragonsync.sh
#
# Cross-file var contract: the paths + URLs + iface defined below are consumed
# by the sourced _deps.sh / _units.sh / _post.sh modules. Shellcheck treats them
# as unused when it can't follow the source (e.g. in trunk's sandboxed runs), so
# SC2034 is disabled at file scope. Locally, `shellcheck -x install-dragonsync.sh`
# still verifies the cross-file usage via the `# shellcheck source=` directives.
# shellcheck disable=SC2034

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Config (auto-detected where possible)
# ─────────────────────────────────────────────────────────────────────────────

# Argos runtime user = invoking sudo user, or owner of the repo, never root.
if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != "root" ]]; then
    ARGOS_USER="$SUDO_USER"
elif [[ -n "${SUDO_UID:-}" ]]; then
    ARGOS_USER="$(getent passwd "$SUDO_UID" | cut -d: -f1)"
else
    # Fallback: owner of the repo root (resolves script parent -> repo root).
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    ARGOS_USER="$(stat -c '%U' "$REPO_ROOT")"
fi

if [[ -z "$ARGOS_USER" || "$ARGOS_USER" == "root" ]]; then
    echo "[-] Could not determine non-root Argos user. Re-run via 'sudo' from that user's session." >&2
    exit 1
fi
ARGOS_GROUP="$(id -gn "$ARGOS_USER")"
ARGOS_HOME="$(getent passwd "$ARGOS_USER" | cut -d: -f6)"

DRAGONSYNC_DIR="/opt/dragonsync"
DRONEID_DIR="/opt/droneid-go"
FPV_DIR="/opt/wardragon-fpv-detect"
CONFIG_DIR="/etc/dragonsync"
CONFIG_INI="$CONFIG_DIR/config.ini"

WIFI_IFACE="wlan1"

GR_INSPECTOR_REPO="https://github.com/gnuradio/gr-inspector.git"
DRAGONSYNC_REPO="https://github.com/alphafox02/DragonSync.git"
FPV_REPO="https://github.com/alphafox02/wardragon-fpv-detect.git"
DRONEID_REPO="https://github.com/alphafox02/droneid-go.git"
DRONEID_RELEASE_URL="https://github.com/alphafox02/droneid-go/releases/latest/download/droneid-linux-arm64"

# Argos repo root (used to symlink the drop-in from deployment/ + locate modules).
ARGOS_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DROPIN_SRC="$ARGOS_REPO/deployment/wardragon-fpv-detect.service.d/argos-conflicts.conf"
MODULES_DIR="$(dirname "${BASH_SOURCE[0]}")/dragonsync"

# ─────────────────────────────────────────────────────────────────────────────
# Logging helpers (used by all modules)
# ─────────────────────────────────────────────────────────────────────────────

info()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
err()   { printf '\033[1;31m[-]\033[0m %s\n' "$*" >&2; exit 1; }
step()  { printf '\n\033[1;36m==== %s ====\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || err "Run as root: sudo $0"
[[ -f "$DROPIN_SRC" ]] || err "Cannot find $DROPIN_SRC — run from within a checked-out Argos repo."
[[ -d "$MODULES_DIR" ]] || err "Cannot find module dir $MODULES_DIR — repo layout drifted."

info "Argos user: $ARGOS_USER  (group $ARGOS_GROUP, home $ARGOS_HOME)"
info "Arch: $(uname -m)"
[[ "$(uname -m)" == "aarch64" ]] || warn "Non-aarch64 host — droneid-linux-arm64 download may fail."

# ─────────────────────────────────────────────────────────────────────────────
# Phase modules (sourced in order — each depends on the previous phase's state)
# ─────────────────────────────────────────────────────────────────────────────

# shellcheck source=dragonsync/_deps.sh disable=SC1091
source "$MODULES_DIR/_deps.sh"

# shellcheck source=dragonsync/_units.sh disable=SC1091
source "$MODULES_DIR/_units.sh"

# shellcheck source=dragonsync/_post.sh disable=SC1091
source "$MODULES_DIR/_post.sh"

# ─────────────────────────────────────────────────────────────────────────────
# 8. systemd daemon-reload + sanity checks
# ─────────────────────────────────────────────────────────────────────────────

step "SYSTEMD RELOAD"

systemctl daemon-reload
info "Units visible to systemd:"
for svc in zmq-decoder.service dragonsync.service wardragon-fpv-detect.service; do
    if systemctl cat "$svc" >/dev/null 2>&1; then
        info "  ✓ $svc"
    else
        warn "  ✗ $svc (not loaded!)"
    fi
done

# Verify sudoers works without a password prompt (jetson2 perspective)
if sudo -u "$ARGOS_USER" sudo -n /usr/bin/systemctl is-active dragonsync.service >/dev/null 2>&1; then
    info "sudoers check: $ARGOS_USER can run systemctl is-active dragonsync.service without password."
else
    # Inactive exit code from is-active is 3, still success for sudo invocation
    if sudo -u "$ARGOS_USER" sudo -n /usr/bin/systemctl is-active dragonsync.service >/dev/null; test $? -lt 4; then
        info "sudoers check: passwordless sudo confirmed (is-active returned non-active, which is fine pre-start)."
    else
        warn "sudoers check failed — Argos Start button will prompt for a password."
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

step "INSTALL COMPLETE"
# shellcheck disable=SC2153  # DRONEID_BIN + DRONEID_OK set by sourced _deps.sh
cat <<SUMMARY
  droneid-go binary:    $DRONEID_BIN $( [[ $DRONEID_OK -eq 1 ]] && echo "(OK)" || echo "(MISSING — see warnings above)" )
  DragonSync:           $DRAGONSYNC_DIR
  FPV scanner:          $FPV_DIR
  Config:               $CONFIG_INI
  Run as:               $ARGOS_USER (FPV + DragonSync) / root (zmq-decoder)
  HTTP API:             http://127.0.0.1:8088/drones
  ZMQ endpoints:        4224 (RID) / 4225 (monitor) / 4226 (FPV)

Next steps:
  1. In Argos, open the dashboard and click Start on the UAS panel.
  2. Or manually:  sudo systemctl start zmq-decoder dragonsync wardragon-fpv-detect
  3. Watch logs:   journalctl -u dragonsync -u wardragon-fpv-detect -u zmq-decoder -f
SUMMARY
