#!/usr/bin/env bash
# Install DragonSync + droneid-go + wardragon-fpv-detect for Argos UAS tile.
#
# Idempotent — safe to re-run. Installs on the current host (auto-detects user).
# Does NOT start or enable the services; the operator starts them via the UAS
# panel's Start button (POST /api/dragonsync/control).
#
# Plan: ~/.claude/plans/next-task-1-use-purrfect-brooks.md
#
# Usage:
#   sudo ./scripts/ops/install-dragonsync.sh
#
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

# Argos repo root (used to symlink the drop-in from deployment/).
ARGOS_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DROPIN_SRC="$ARGOS_REPO/deployment/wardragon-fpv-detect.service.d/argos-conflicts.conf"

# ─────────────────────────────────────────────────────────────────────────────
# Logging helpers
# ─────────────────────────────────────────────────────────────────────────────

info()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
err()   { printf '\033[1;31m[-]\033[0m %s\n' "$*" >&2; exit 1; }
step()  { printf '\n\033[1;36m==== %s ====\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || err "Run as root: sudo $0"
[[ -f "$DROPIN_SRC" ]] || err "Cannot find $DROPIN_SRC — run from within a checked-out Argos repo."

info "Argos user: $ARGOS_USER  (group $ARGOS_GROUP, home $ARGOS_HOME)"
info "Arch: $(uname -m)"
[[ "$(uname -m)" == "aarch64" ]] || warn "Non-aarch64 host — droneid-linux-arm64 download may fail."

# ─────────────────────────────────────────────────────────────────────────────
# 1. Apt dependencies (skip already-installed packages)
# ─────────────────────────────────────────────────────────────────────────────

step "APT DEPENDENCIES"

REQUIRED_PKGS=(
    gr-osmosdr qtbase5-dev qt5-qmake libqwt-qt5-dev libqt5svg5-dev
    libsndfile1-dev
    g++ pkg-config git python3-pip
    libpcap0.8 libzmq5 lm-sensors gpsd gpsd-clients iproute2 iw
)

MISSING=()
for pkg in "${REQUIRED_PKGS[@]}"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || MISSING+=("$pkg")
done

if [[ ${#MISSING[@]} -eq 0 ]]; then
    info "All apt deps already installed."
else
    info "Installing: ${MISSING[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q "${MISSING[@]}"
fi

# Verify key deps we DON'T install (plan skips because they should already exist)
for pkg in gnuradio gnuradio-dev libuhd-dev uhd-host; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
        warn "Missing '$pkg' — attempting apt install"
        DEBIAN_FRONTEND=noninteractive apt-get install -y -q "$pkg"
    fi
done

# Python runtime sanity check
python3 -c "import zmq, pmt" \
    || err "python3 zmq/pmt import failed — reinstall python3-gnuradio + python3-zmq"

# ─────────────────────────────────────────────────────────────────────────────
# 1b. libzmq >= 4.3.5 for droneid-go
# Jammy ships libzmq5 4.3.4; droneid-go's Go zmq4 binding is compiled against
# 4.3.5 and refuses to init on older runtime. Build from source into
# /usr/local/lib/ and let the zmq-decoder unit set LD_LIBRARY_PATH.
# ─────────────────────────────────────────────────────────────────────────────

step "libzmq (>=4.3.5) for droneid-go"

need_libzmq_build() {
    # If /usr/local/lib/libzmq.so.5.x exists and >= 4.3.5, reuse it.
    if [[ -f /usr/local/lib/libzmq.so.5.2.5 ]] || \
       (ldconfig -p | grep -q '/usr/local/lib/libzmq.so.5' && \
        strings /usr/local/lib/libzmq.so.5 2>/dev/null | grep -qE 'ZMQ_VERSION.*4\.3\.([5-9]|[1-9][0-9])'); then
        return 1
    fi
    return 0
}

if need_libzmq_build; then
    info "Building libzmq 4.3.5 from source..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q libtool automake autoconf >/dev/null
    LIBZMQ_SRC="/tmp/libzmq-4.3.5"
    rm -rf "$LIBZMQ_SRC"
    curl -fsSL "https://github.com/zeromq/libzmq/releases/download/v4.3.5/zeromq-4.3.5.tar.gz" \
        | tar -xz -C /tmp
    mv /tmp/zeromq-4.3.5 "$LIBZMQ_SRC"
    (cd "$LIBZMQ_SRC" && ./configure --prefix=/usr/local --without-docs --without-libsodium --disable-perf >/dev/null 2>&1)
    (cd "$LIBZMQ_SRC" && make -j"$(nproc)" >/dev/null 2>&1)
    (cd "$LIBZMQ_SRC" && make install >/dev/null 2>&1)
    ldconfig
    rm -rf "$LIBZMQ_SRC"
    info "libzmq 4.3.5 installed to /usr/local/lib/"
else
    info "libzmq >=4.3.5 already available — skipping build."
fi
test -f /usr/local/lib/libzmq.so.5 \
    || err "libzmq install failed — /usr/local/lib/libzmq.so.5 missing"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Build gr-inspector from source (if not already installed)
# ─────────────────────────────────────────────────────────────────────────────

step "gr-inspector"

if python3 -c "from gnuradio import inspector" >/dev/null 2>&1; then
    info "gr-inspector Python module already present — skipping build."
else
    BUILD_DIR="/tmp/gr-inspector-build"
    rm -rf "$BUILD_DIR"
    info "Cloning gr-inspector..."
    git clone --depth 1 "$GR_INSPECTOR_REPO" "$BUILD_DIR"
    mkdir -p "$BUILD_DIR/build"
    info "Configuring (cmake)..."
    (cd "$BUILD_DIR/build" && cmake -DCMAKE_BUILD_TYPE=Release ..)
    info "Compiling (this takes ~10-15 min on AGX Orin)..."
    (cd "$BUILD_DIR/build" && make -j"$(nproc)")
    info "Installing..."
    (cd "$BUILD_DIR/build" && make install)
    ldconfig
    python3 -c "from gnuradio import inspector; print('    inspector OK:', inspector.__file__)" \
        || err "gr-inspector build succeeded but Python import still fails."
    rm -rf "$BUILD_DIR"
fi

# gr-osmosdr sanity — upstream fpv_energy_scan.py:16 does `import osmosdr`.
python3 -c "import osmosdr" \
    || err "gr-osmosdr not importable — scanner would fail at runtime."

# ─────────────────────────────────────────────────────────────────────────────
# 3. Clone DragonSync + wardragon-fpv-detect (idempotent git pull)
# ─────────────────────────────────────────────────────────────────────────────

step "CLONE REPOS"

clone_or_update() {
    local repo="$1" dest="$2" submodules="${3:-}"
    if [[ -d "$dest/.git" ]]; then
        info "Updating $(basename "$dest")..."
        sudo -u "$ARGOS_USER" git -C "$dest" fetch --quiet origin
        sudo -u "$ARGOS_USER" git -C "$dest" pull --ff-only --quiet || \
            warn "git pull failed in $dest — leaving existing checkout."
        if [[ -n "$submodules" ]]; then
            sudo -u "$ARGOS_USER" git -C "$dest" submodule update --init --recursive --quiet
        fi
    else
        info "Cloning $(basename "$dest")..."
        mkdir -p "$dest"
        chown "$ARGOS_USER:$ARGOS_GROUP" "$dest"
        if [[ -n "$submodules" ]]; then
            sudo -u "$ARGOS_USER" git clone --recurse-submodules --quiet "$repo" "$dest"
        else
            sudo -u "$ARGOS_USER" git clone --quiet "$repo" "$dest"
        fi
    fi
}

clone_or_update "$DRAGONSYNC_REPO" "$DRAGONSYNC_DIR" with-submodules
clone_or_update "$FPV_REPO"        "$FPV_DIR"

info "Installing DragonSync Python deps..."
# Ubuntu 22.04 pip (22.0.2) predates --break-system-packages. Ubuntu 24.04+ enforces PEP 668;
# add the flag only when pip supports it, otherwise plain install works.
PIP_FLAGS="-q"
if sudo -u "$ARGOS_USER" pip3 install --help 2>/dev/null | grep -q -- '--break-system-packages'; then
    PIP_FLAGS="-q --break-system-packages"
fi
sudo -u "$ARGOS_USER" pip3 install $PIP_FLAGS -r "$DRAGONSYNC_DIR/requirements.txt"

# ─────────────────────────────────────────────────────────────────────────────
# 3b. Extend scanner frequency list to 91 unique centers (Phase 2)
# Idempotent Python patcher — inserts WIFI_ISM_MHZ + extends ALL_CENTERS_MHZ.
# No-op if already applied (marker _ARGOS_EXTENDED_BANDS_MARKER present).
# ─────────────────────────────────────────────────────────────────────────────

step "EXTEND SCANNER BANDS"

PATCHER="$ARGOS_REPO/deployment/patches/wardragon-fpv-detect-extended-bands.py"
if [[ -f "$PATCHER" ]]; then
    python3 "$PATCHER" || warn "Extended-bands patcher exited non-zero — scanner will run with upstream 58 centers."
else
    warn "Patcher not found at $PATCHER — skipping band extension."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. /etc/dragonsync/config.ini (from upstream, key-patched)
# ─────────────────────────────────────────────────────────────────────────────

step "CONFIG"

mkdir -p "$CONFIG_DIR"
chown "$ARGOS_USER:$ARGOS_GROUP" "$CONFIG_DIR"
chmod 0750 "$CONFIG_DIR"

if [[ ! -f "$CONFIG_INI" ]]; then
    if [[ -f "$DRAGONSYNC_DIR/config.ini" ]]; then
        install -o "$ARGOS_USER" -g "$ARGOS_GROUP" -m 0640 "$DRAGONSYNC_DIR/config.ini" "$CONFIG_INI"
    else
        err "DragonSync config.ini missing in repo — upstream changed layout?"
    fi
else
    info "$CONFIG_INI exists — patching in place."
fi

# Idempotent key patcher: set key=value if key exists (uncommented), else append.
patch_key() {
    local key="$1" val="$2" file="$3"
    if grep -Eq "^[[:space:]]*${key}[[:space:]]*=" "$file"; then
        sed -i -E "s|^[[:space:]]*(${key})[[:space:]]*=.*|\1 = ${val}|" "$file"
    else
        printf '%s = %s\n' "$key" "$val" >> "$file"
    fi
}

# Keys per plan (verified against upstream DragonSync/config.ini)
patch_key api_enabled        true           "$CONFIG_INI"
patch_key api_host            127.0.0.1     "$CONFIG_INI"
patch_key api_port            8088          "$CONFIG_INI"
patch_key zmq_host            127.0.0.1     "$CONFIG_INI"
patch_key zmq_port            4224          "$CONFIG_INI"
patch_key zmq_status_port     4225          "$CONFIG_INI"
patch_key fpv_enabled         true          "$CONFIG_INI"
patch_key fpv_zmq_host        127.0.0.1     "$CONFIG_INI"
patch_key fpv_zmq_port        4226          "$CONFIG_INI"
patch_key fpv_confirm_only    false         "$CONFIG_INI"
patch_key enable_multicast    false         "$CONFIG_INI"

chown "$ARGOS_USER:$ARGOS_GROUP" "$CONFIG_INI"
chmod 0640 "$CONFIG_INI"
info "config.ini patched (api/zmq/fpv keys set)."

# ─────────────────────────────────────────────────────────────────────────────
# 5. droneid-go binary acquisition (closed-source — may require manual step)
# ─────────────────────────────────────────────────────────────────────────────

step "droneid-go BINARY"

mkdir -p "$DRONEID_DIR"

# Keep the repo metadata around (LICENSE / README) for future operator reference,
# but we only really need the binary at $DRONEID_DIR/droneid.
if [[ ! -d "$DRONEID_DIR/.git" ]]; then
    info "Cloning droneid-go metadata (LICENSE/README only; binary fetched separately)..."
    git clone --depth 1 --quiet "$DRONEID_REPO" "$DRONEID_DIR" || \
        warn "Could not clone droneid-go repo (non-fatal — only metadata)."
fi

DRONEID_BIN="$DRONEID_DIR/droneid"
DRONEID_OK=0
# Priority order:
#   1. Existing $DRONEID_BIN (idempotent rerun)
#   2. Vendored binary in cloned repo at bin/droneid-linux-arm64
#   3. GitHub Releases download (fallback if repo layout changes)
VENDORED_BIN="$DRONEID_DIR/bin/droneid-linux-arm64"
if [[ -x "$DRONEID_BIN" ]] && file "$DRONEID_BIN" 2>/dev/null | grep -q 'ELF 64-bit LSB.*ARM aarch64'; then
    info "droneid binary already present: $DRONEID_BIN"
    DRONEID_OK=1
elif [[ -f "$VENDORED_BIN" ]] && file "$VENDORED_BIN" 2>/dev/null | grep -q 'ELF 64-bit LSB.*ARM aarch64'; then
    install -o root -g root -m 0755 "$VENDORED_BIN" "$DRONEID_BIN"
    DRONEID_OK=1
    info "droneid binary installed from vendored clone: $DRONEID_BIN ($(stat -c%s "$DRONEID_BIN") bytes)"
else
    info "No vendored binary — attempting to fetch droneid-linux-arm64 from GitHub Releases..."
    TMP_BIN="$(mktemp)"
    if curl -fsSL "$DRONEID_RELEASE_URL" -o "$TMP_BIN" 2>/dev/null; then
        if file "$TMP_BIN" | grep -q 'ELF 64-bit LSB.*ARM aarch64'; then
            install -o root -g root -m 0755 "$TMP_BIN" "$DRONEID_BIN"
            rm -f "$TMP_BIN"
            DRONEID_OK=1
            info "droneid binary installed from release: $DRONEID_BIN ($(stat -c%s "$DRONEID_BIN") bytes)"
        else
            rm -f "$TMP_BIN"
            warn "Downloaded file is NOT an aarch64 ELF — skipping."
        fi
    else
        rm -f "$TMP_BIN"
        warn "No public release asset at $DRONEID_RELEASE_URL"
    fi
fi

if [[ $DRONEID_OK -ne 1 ]]; then
    warn "droneid-linux-arm64 is NOT publicly distributed (droneid-go is closed source)."
    warn "Obtain the binary from alphafox02 (WarDragon kit owners/licensees) and place at:"
    warn "    $DRONEID_BIN    (mode 0755, owner root)"
    warn "The rest of the stack is still installed; zmq-decoder.service will fail until"
    warn "the binary is present. Argos UAS panel will show 'droneid-go' red dot."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. systemd units
# ─────────────────────────────────────────────────────────────────────────────

step "SYSTEMD UNITS"

cat > /etc/systemd/system/zmq-decoder.service <<EOF
[Unit]
Description=DroneID ZMQ Decoder (droneid-go)
Documentation=https://github.com/alphafox02/droneid-go
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$DRONEID_DIR
# droneid-go's Go zmq4 binding is compiled against libzmq 4.3.5; jammy ships 4.3.4.
# Installer built 4.3.5 into /usr/local/lib/ — point the binary at it.
Environment=LD_LIBRARY_PATH=/usr/local/lib
# Bring wlan1 up before droneid claims monitor mode.
ExecStartPre=-/usr/sbin/ip link set $WIFI_IFACE up
ExecStart=$DRONEID_BIN -i $WIFI_IFACE -g -ble auto -z -zmqsetting 127.0.0.1:4224
Restart=on-failure
RestartSec=5
# droneid-go's BLE retry loop ignores SIGTERM; don't let systemd spend 90 s
# waiting before SIGKILL — UI Stop would block that long.
TimeoutStopSec=5
KillMode=mixed
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zmq-decoder

# Hardening consistent with upstream zmq-decoder.service
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=yes
ReadWritePaths=/sys/class/net

[Install]
WantedBy=multi-user.target
EOF
info "Wrote /etc/systemd/system/zmq-decoder.service"

cat > /etc/systemd/system/dragonsync.service <<EOF
[Unit]
Description=DragonSync Drone Fusion Service
Documentation=https://github.com/alphafox02/DragonSync
After=network.target zmq-decoder.service
Wants=zmq-decoder.service

[Service]
Type=simple
User=$ARGOS_USER
Group=$ARGOS_GROUP
WorkingDirectory=$DRAGONSYNC_DIR
ExecStart=/usr/bin/python3 $DRAGONSYNC_DIR/dragonsync.py -c $CONFIG_INI
Restart=on-failure
RestartSec=5
TimeoutStopSec=10
KillMode=mixed
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dragonsync

[Install]
WantedBy=multi-user.target
EOF
info "Wrote /etc/systemd/system/dragonsync.service"

cat > /etc/systemd/system/wardragon-fpv-detect.service <<EOF
[Unit]
Description=WarDragon FPV Energy Scanner (B205mini)
Documentation=https://github.com/alphafox02/wardragon-fpv-detect
After=network.target dragonsync.service
Wants=dragonsync.service

[Service]
Type=simple
User=$ARGOS_USER
Group=$ARGOS_GROUP
WorkingDirectory=$FPV_DIR
Environment=FPV_DJI_GUARD=0
Environment=HOME=$ARGOS_HOME
# Phase 3 overflow remediation (see plan Phase 3).
# - num_recv_frames/recv_frame_size: 32x/8x over UHD B200 defaults (16/1024) to
#   absorb retune-induced USB drain stalls. Source: EttusResearch/uhd
#   host/lib/usrp/b200/b200_impl.cpp:472-490 for defaults, sdrstore.eu B210
#   troubleshooting guide for the 512/8192 recommendation.
# - master_clock_rate=16e6: pin ADC at 16 MHz so samp_rate=8 MHz is a clean
#   2x decimation (one half-band stage) instead of UHD's auto-32 MHz (4x, two
#   stages). Halves UHD decimator CPU. Source: UHD manual "Automatic Clock
#   Rate Setting" section.
ExecStart=/usr/bin/python3 $FPV_DIR/scripts/fpv_energy_scan.py \
  -z --zmq-endpoint tcp://127.0.0.1:4226 \
  --monitor-endpoint tcp://127.0.0.1:4225 \
  --osmosdr-args uhd,type=b200,num_recv_frames=512,recv_frame_size=8200,master_clock_rate=16e6 \
  --samp-rate 8000000 --bandwidth 8000000 --gain 50 \
  --confirm-threshold 60
Restart=on-failure
RestartSec=5
# GNURadio flowgraph teardown is fast; give it a small budget then SIGKILL.
TimeoutStopSec=10
KillMode=mixed
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wardragon-fpv-detect

# Realtime scheduling so GNURadio's usrp_source worker is not preempted by
# other Argos threads (map rendering, status poller). CAP_SYS_NICE is needed
# because the unit runs as a non-root user.
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=50
Nice=-10
AmbientCapabilities=CAP_SYS_NICE

[Install]
WantedBy=multi-user.target
EOF
info "Wrote /etc/systemd/system/wardragon-fpv-detect.service"

# Drop-in symlink (sparrow B205 mutex)
mkdir -p /etc/systemd/system/wardragon-fpv-detect.service.d
ln -sfn "$DROPIN_SRC" /etc/systemd/system/wardragon-fpv-detect.service.d/argos-conflicts.conf
info "Linked argos-conflicts.conf drop-in"

# ─────────────────────────────────────────────────────────────────────────────
# 6b. Argos C2 scanner (HackRF, sub-GHz — Phase 5)
# Dedicated HackRF sweep for ELRS / TBS / SiK / FrSky / GPS-L1 bands. Runs in
# parallel with FPV (B205) — different radio, no contention.
# ─────────────────────────────────────────────────────────────────────────────

C2_DIR="/opt/argos-c2-scanner"
C2_SRC="$ARGOS_REPO/deployment/argos-c2-scanner"

mkdir -p "$C2_DIR"
install -m 0755 "$C2_SRC/c2_scan.py" "$C2_DIR/c2_scan.py"
install -m 0755 "$C2_SRC/c2-subscriber.py" "$C2_DIR/c2-subscriber.py"
chown -R "$ARGOS_USER:$ARGOS_GROUP" "$C2_DIR"
info "Installed c2_scan.py + c2-subscriber.py to $C2_DIR/"

# Substitute placeholders in unit template then install to /etc/systemd/system/
sed -e "s|__ARGOS_USER__|$ARGOS_USER|g" \
    -e "s|__ARGOS_GROUP__|$ARGOS_GROUP|g" \
    -e "s|__ARGOS_HOME__|$ARGOS_HOME|g" \
    "$C2_SRC/argos-c2-scanner.service" \
    > /etc/systemd/system/argos-c2-scanner.service
info "Wrote /etc/systemd/system/argos-c2-scanner.service"

# ─────────────────────────────────────────────────────────────────────────────
# 7. sudoers for Argos runtime user
# ─────────────────────────────────────────────────────────────────────────────

step "SUDOERS"

SUDOERS_TMP="/etc/sudoers.d/argos-dragonsync.new"
SUDOERS_FINAL="/etc/sudoers.d/argos-dragonsync"

cat > "$SUDOERS_TMP" <<EOF
# Argos — DragonSync / droneid-go / wardragon-fpv-detect lifecycle control
# Generated by scripts/ops/install-dragonsync.sh — do not edit by hand.
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start zmq-decoder.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop zmq-decoder.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active zmq-decoder.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start dragonsync.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop dragonsync.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active dragonsync.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start wardragon-fpv-detect.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop wardragon-fpv-detect.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active wardragon-fpv-detect.service
# Phase 5: Argos C2 scanner (HackRF sub-GHz sweep)
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-c2-scanner.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-c2-scanner.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active argos-c2-scanner.service
# Phase 2: SSE log streamer uses journalctl -f for the three services.
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u dragonsync -u zmq-decoder -u wardragon-fpv-detect -f --output=short-iso --no-pager
# Phase 5: SSE log streamer includes argos-c2-scanner when both scanners active
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u dragonsync -u zmq-decoder -u wardragon-fpv-detect -u argos-c2-scanner -f --output=short-iso --no-pager
EOF
chmod 0440 "$SUDOERS_TMP"
if visudo -cf "$SUDOERS_TMP" >/dev/null; then
    mv "$SUDOERS_TMP" "$SUDOERS_FINAL"
    info "Installed $SUDOERS_FINAL"
else
    rm -f "$SUDOERS_TMP"
    err "sudoers syntax check failed — bailing."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7b. UHD / Jetson tuning (Phase 3 overflow remediation)
# Kernel socket buffers per UHD B210 troubleshooting guidance + Jetson-specific
# max-perf mode (nvpmodel -m 0, jetson_clocks). See plan Phase 3.
# ─────────────────────────────────────────────────────────────────────────────

step "UHD TUNING"

# Kernel socket buffers — sdrstore.eu B210 guide recommends 50 MB.
SYSCTL_FILE="/etc/sysctl.d/99-argos-uhd.conf"
cat > "$SYSCTL_FILE" <<EOF
# Argos UHD overflow remediation — 50 MB rx/tx socket buffers.
# Raised from jammy defaults (~212 KB) per sdrstore.eu B210 troubleshooting
# guide. Helps USRP B200-series sustain high sample rates without xhci drops.
net.core.rmem_max = 50000000
net.core.rmem_default = 50000000
net.core.wmem_max = 50000000
net.core.wmem_default = 50000000

# Argos SSE log-streamer — raise inotify watch limit so journalctl -f on three
# services can use inotify instead of falling back to polling. Symptom without
# this: the scan view shows 'Insufficient watch descriptors available.
# Reverting to -n.' and EventSource flaps on reconnect. Jetson default is
# 8192 which is quickly exhausted by journald + argos + chromium + editors.
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512
EOF
chmod 0644 "$SYSCTL_FILE"
if sysctl --system >/dev/null 2>&1; then
    info "Applied kernel socket buffer tuning ($SYSCTL_FILE)."
else
    warn "sysctl --system returned non-zero; tuning may not take effect."
fi

# Jetson-specific max performance. On aarch64 Tegra, cpupower is unreliable;
# NVIDIA's own tools (nvpmodel + jetson_clocks) are authoritative.
if [[ -f /etc/nv_tegra_release ]]; then
    if command -v nvpmodel >/dev/null 2>&1; then
        if nvpmodel -m 0 >/dev/null 2>&1; then
            info "Set nvpmodel to MAXN (mode 0)."
        else
            warn "nvpmodel -m 0 failed; current mode preserved."
        fi
    fi
    if command -v jetson_clocks >/dev/null 2>&1; then
        if jetson_clocks >/dev/null 2>&1; then
            info "Pinned Jetson clocks to max (DVFS disabled)."
        else
            warn "jetson_clocks failed; DVFS throttling remains active."
        fi
    fi
else
    info "Non-Jetson host — skipping nvpmodel/jetson_clocks."
fi

# USB 3 SuperSpeed diagnostic — warn if B205 is on USB 2 (480M).
# Ettus USRP B200-series VID:PID 2500:0022
if lsusb -v -d 2500:0022 2>/dev/null | grep -q 'bcdUSB.*2\.\(00\|1\)'; then
    warn "B205mini is enumerating at USB 2 speed (480 Mbps)."
    warn "Sustained 8 Msps requires USB 3 SuperSpeed (5000 Mbps)."
    warn "Move the B205mini to a blue USB 3 port on the Jetson."
elif lsusb -t 2>/dev/null | awk '/Bus 02/,/Bus 01/' | grep -qE '5000M.*Vendor'; then
    info "B205mini on USB 3 SuperSpeed (5 Gbps) — OK."
fi

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
