#!/usr/bin/env bash
# Module: system dependencies, upstream clones, scanner-band patcher,
# DragonSync config.ini generation, droneid-go binary acquisition.
#
# Sourced by scripts/ops/install-dragonsync.sh — do not run directly.
# Depends on caller setting: ARGOS_USER, ARGOS_GROUP, DRAGONSYNC_DIR,
# DRONEID_DIR, FPV_DIR, CONFIG_DIR, CONFIG_INI, ARGOS_REPO,
# GR_INSPECTOR_REPO, DRAGONSYNC_REPO, FPV_REPO, DRONEID_REPO,
# DRONEID_RELEASE_URL, and the info/warn/err/step logging helpers.
# Exports: DRONEID_BIN, DRONEID_OK (consumed by _units.sh + summary).

[[ -n "${ARGOS_USER:-}" ]] || { echo "[_deps.sh] must be sourced by install-dragonsync.sh" >&2; exit 1; }

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
