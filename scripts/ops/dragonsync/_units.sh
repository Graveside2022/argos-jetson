#!/usr/bin/env bash
# Module: systemd unit generation for zmq-decoder, dragonsync,
# wardragon-fpv-detect, argos-c2-scanner, wardragon-monitor.
#
# Sourced by scripts/ops/install-dragonsync.sh — do not run directly.
# Depends on: ARGOS_USER, ARGOS_GROUP, ARGOS_HOME, ARGOS_REPO, WIFI_IFACE,
# DRONEID_DIR, DRONEID_BIN, DRAGONSYNC_DIR, FPV_DIR, CONFIG_INI, DROPIN_SRC,
# and the info/warn/err/step logging helpers.

[[ -n "${ARGOS_USER:-}" ]] || { echo "[_units.sh] must be sourced by install-dragonsync.sh" >&2; exit 1; }

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
ExecStart=$DRONEID_BIN -i $WIFI_IFACE \\
  -hop \\
  -hop-channels "1,6,11,149,153,157,161,165" \\
  -hop-cycle    "1,1,1,1,1,1,1,1" \\
  -z -zmqsetting 127.0.0.1:4224
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
# 6c. WarDragon system monitor (GPS + sensor telemetry → ZMQ 4225)
# DragonSync subscribes to 4225 for system status; without it /status returns
# HTTP 503 "system status unavailable" and drone alerts lack lat/lon stamps.
# wardragon_monitor.py ships in the DragonSync repo clone; it reads from the
# already-running gpsd on :2947 and republishes in DragonSync's schema.
# Sources verified:
#   - /opt/dragonsync git remote = alphafox02/DragonSync.git
#   - wardragon_monitor.py flags match --help (--zmq_host/--zmq_port/--interval)
#   - /etc/dragonsync/config.ini expects zmq_status_port=4225, zmq_host=127.0.0.1
# ─────────────────────────────────────────────────────────────────────────────

step "WARDRAGON MONITOR"

MONITOR_SCRIPT="$DRAGONSYNC_DIR/wardragon_monitor.py"
if [[ ! -f "$MONITOR_SCRIPT" ]]; then
    warn "Expected $MONITOR_SCRIPT missing — DragonSync repo layout changed upstream. Skipping monitor unit."
else
    cat > /etc/systemd/system/wardragon-monitor.service <<EOF
[Unit]
Description=WarDragon System Monitor (GPS + sensors → ZMQ 4225)
Documentation=https://github.com/alphafox02/DragonSync
After=network.target gpsd.service
Wants=gpsd.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$DRAGONSYNC_DIR
# Bind to 127.0.0.1 (NOT upstream default 0.0.0.0) to match Argos
# security model. DragonSync subscribes locally per config.ini.
ExecStart=/usr/bin/python3 $MONITOR_SCRIPT \\
  --zmq_host 127.0.0.1 \\
  --zmq_port 4225 \\
  --interval 30
Restart=on-failure
RestartSec=5
TimeoutStopSec=5
KillMode=mixed
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wardragon-monitor

# Hardening consistent with zmq-decoder pattern
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF
    info "Wrote /etc/systemd/system/wardragon-monitor.service"

    # Enable + start immediately — this is a passive telemetry publisher that
    # should be always-on (not gated by the UI Start button like the 4 UAS
    # scanner/fusion units). Matches upstream WarDragon deployment pattern.
    systemctl enable --now wardragon-monitor.service >/dev/null 2>&1 || \
        warn "Failed to enable/start wardragon-monitor — check journalctl -u wardragon-monitor"
    info "wardragon-monitor enabled + started (publishes GPS/system on tcp://127.0.0.1:4225)"
fi
