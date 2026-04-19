# Argos on Jetson AGX Orin (Ubuntu 22.04 jammy, aarch64)

End-to-end install guide for running Argos on an NVIDIA Jetson AGX Orin
developer kit. Captures every workaround discovered during the Jetson
port (April 2026). Deltas vs the Raspberry Pi 5 / Kali install live in
the **Platform deltas** section at the bottom.

---

## 1. Hardware target

| Component          | Tested model                                     | Notes                                                        |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| Compute            | NVIDIA Jetson AGX Orin Developer Kit             | 32 GB RAM variant                                            |
| OS                 | Ubuntu 22.04 jammy aarch64 (JetPack 6.x BSP)     | Native, no Docker for the app                                |
| SDR                | **Ettus USRP B205mini** (USB Micro-B SuperSpeed) | Required for Blue Dragon wideband BLE                        |
| Optional SDR       | HackRF One                                       | For HackRF-only paths                                        |
| GPS                | u-blox 7 USB                                     | For GPSd / map plotting / TAK                                |
| Bluetooth (system) | Any HCI-compatible adapter                       | Required for `--active-scan`                                 |
| Display            | HDMI                                             | TigerVNC works headless; `modprobe nvidia-drm` may be needed |

> **B205mini USB 3 advisory.** The radio MUST enumerate at SuperSpeed
> (5000 Mbps, USB 3.0) for Blue Dragon's 40-channel wideband mode. Use
> the SuperSpeed USB Micro-B cable shipped with the B205 — a regular
> USB 2.0 Micro-B cable physically fits but only negotiates 480 Mbps,
> capping you at roughly 16 channels.

---

## 2. Pre-install checklist

```bash
sudo apt-get update
sudo apt-get install -y curl git build-essential pkg-config

# Verify aarch64
uname -m       # → aarch64
lsb_release -a # → Ubuntu 22.04 jammy

# Useful diagnostics
sudo apt-get install -y usbutils lsof
```

Set the host name and timezone if you haven't already. The Argos
dashboard reads `/etc/hostname` for the operator badge.

---

## 3. Node.js + project clone

Argos targets Node 22.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source "$HOME/.nvm/nvm.sh"
nvm install 22
nvm alias default 22

git clone https://github.com/Graveside2022/argos-jetson.git ~/code/Argos
cd ~/code/Argos
npm install
```

Copy `.env.example` to `.env` and set `ARGOS_API_KEY` (≥32 hex chars):

```bash
cp .env.example .env
echo "ARGOS_API_KEY=$(openssl rand -hex 32)" >> .env
```

The system **refuses to start** without `ARGOS_API_KEY` set.

---

## 4. UHD (Universal Hardware Driver) for the B205mini

Install the Ubuntu jammy package set:

```bash
sudo apt-get install -y libuhd-dev libuhd4.1.0 uhd-host
```

Install the udev rules so non-root code can talk to the radio:

```bash
sudo cp /usr/lib/uhd/utils/uhd-usrp.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
```

**Verify the radio enumerates without sudo:**

```bash
uhd_find_devices
# Expect a single line like:
#   serial: 329F4D0   name: B205i   product: B205mini   type: b200

uhd_usrp_probe --args="serial=YOUR-SERIAL" | head -20
# Look for:
#   [B200] Detected Device: B205mini
#   [B200] Operating over USB 3.        ← critical — must say USB 3
#   [B200] Register loopback test passed
```

**If `Operating over USB 2.`** → the cable or port is wrong. See
**Troubleshooting → USB 2 fallback** below.

> Ubuntu jammy ships UHD **4.1.0.5**, which is well above the B205mini
> minimum of 3.8.4. The Ettus PPA (`ppa:ettusresearch/uhd`) ships
> 4.9.0.0 if you want the latest — optional.

---

## 5. Blue Dragon (wideband BLE/BT capture binary)

Blue Dragon is a Rust crate maintained by alphafox02. Argos calls it as
a child process and consumes its PCAP output via tshark.

### 5.1 Install the Rust toolchain (skip if already present)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

### 5.2 Install build dependencies

```bash
sudo apt-get install -y \
  libdbus-1-dev \
  libzmq3-dev \
  libgps-dev \
  protobuf-compiler   # NOTE: jammy ships protoc 3.12 — too old, see 5.3
```

### 5.3 Replace protoc with v30.2 (proto3 optional support)

The WHAD protocol files Blue Dragon depends on use proto3 optional
fields, which require **protoc ≥ 3.15**. Ubuntu jammy's package is
3.12.4. Install the upstream binary:

```bash
cd /tmp
wget https://github.com/protocolbuffers/protobuf/releases/download/v30.2/protoc-30.2-linux-aarch_64.zip
sudo unzip -o protoc-30.2-linux-aarch_64.zip -d /usr/local
sudo chmod 755 /usr/local/bin/protoc
hash -r
protoc --version    # → libprotoc 30.2
```

`/usr/local/bin` precedes `/usr/bin` in `$PATH` by default on Ubuntu,
so the upstream binary takes precedence over the apt package.

### 5.4 Clone + build

```bash
git clone https://github.com/alphafox02/blue-dragon.git \
  ~/code/Argos/tactical/blue-dragon
cd ~/code/Argos/tactical/blue-dragon

# IMPORTANT: -p blue-dragon scopes the build to the binary crate.
# Without it, cargo also builds the bd-gpu workspace member which
# requires OpenCL headers that Jetson does not ship by default.
cargo build --release -p blue-dragon --features "usrp,zmq,gps"
```

Build time: ~10–15 minutes on Jetson AGX Orin from a cold cache,
~20–30 seconds incremental.

**Verify the binary detects the radio:**

```bash
./target/release/blue-dragon --list
# Expect:
#   usrp-B205mini-329F4D0 (type=b200)
```

### 5.5 Wire Blue Dragon into Argos via .env

The Argos process-manager reads three env vars (defaults are
RPi/Kali-biased — they _must_ be overridden on Jetson):

```bash
cd ~/code/Argos
cat <<EOF >> .env

# Blue Dragon (wideband BLE/BT capture via USRP B205mini)
BD_BIN=$HOME/code/Argos/tactical/blue-dragon/target/release/blue-dragon
BD_INTERFACE=usrp-B205mini-YOUR-SERIAL
BD_PCAP_PATH=/tmp/bd-live.fifo
EOF
```

Replace `YOUR-SERIAL` with the serial you saw in `uhd_find_devices`.

---

## 6. tshark (Wireshark CLI — pcap parser)

Argos's `pcap-stream-parser.ts` spawns `tshark` to read the FIFO that
Blue Dragon writes to. Without tshark the parser silently dies and
Blue Dragon blocks on FIFO write-open.

```bash
sudo apt-get install -y tshark
# debconf prompt: "Should non-superusers be able to capture packets?"
# → answer NO. Argos reads from a FIFO via tshark -r, never from a
#   live network interface, so dumpcap setcap is not required.

tshark --version | head -1   # → TShark (Wireshark) 3.6.2 (or newer)
```

If the install hangs on the debconf prompt non-interactively:

```bash
sudo dpkg --configure -a
```

---

## 7. Optional services

### GPSd (for `--gpsd` flag + map markers + TAK)

```bash
sudo apt-get install -y gpsd gpsd-clients
# Edit /etc/default/gpsd to point at /dev/ttyACM0 (u-blox 7)
sudo systemctl enable --now gpsd.socket
gpspipe -w | head -3   # smoke test
```

### Headless Chromium for the chrome-devtools MCP

Jetson aarch64 has no Google Chrome build. Use snap chromium:

```bash
sudo snap install chromium

# Pre-launch headless with remote debugging on :9222
/snap/bin/chromium --headless=new --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chromium-debug-profile" \
  --no-first-run --disable-gpu &

curl -s http://127.0.0.1:9222/json/version | head
```

---

## 8. First boot

```bash
cd ~/code/Argos
npm run dev:clean    # kills stale, restarts in tmux session "argos-logs"
npm run dev:logs     # tail dev server output

# Server up on http://<jetson-ip>:5173
```

Open the dashboard, click the **Bluetooth** tab in the bottom panel,
choose a profile (CLEAN / VOLUME / MAX), optionally toggle **ALL CH
/ ACTIVE / GPS / CODED**, click **Start**.

You should see devices populate within ~2 seconds in 40-channel mode.

---

## 9. End-to-end verification

```bash
# Smoke test the API directly
API_KEY=$(grep ARGOS_API_KEY .env | cut -d= -f2)
URL="http://127.0.0.1:5173/api/bluedragon/control"

curl -s -X POST -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"action":"start","profile":"volume"}' "$URL" | jq .

# Should return success + non-null PID
pgrep -af blue-dragon

# Stop
curl -s -X POST -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"action":"stop"}' "$URL" | jq .
```

---

## 10. Troubleshooting

### USB 2 fallback (`Operating over USB 2.` from `uhd_usrp_probe`)

Three causes, in order of likelihood:

1. **Wrong cable.** B205mini side requires a USB 3 SuperSpeed Micro-B
   cable — the connector has two side-by-side contact blocks (the
   regular 2.0 strip + the extra 5-pin SuperSpeed strip), often blue.
   Regular Micro-B 2.0 fits but caps at 480M.
2. **Wrong port.** Some Jetson carrier-board USB-A jacks are USB
   2.0-only headers. Try every blue USB-A port; verify with `lsusb -t`
   that the B205 lands under the `10000M` root_hub (Bus 02 on AGX
   Orin), not the `480M` root_hub (Bus 01).
3. **USB 2 hub in path.** Even a SuperSpeed-capable hub will fall
   back to USB 2 if the upstream link is 2.0. Plug B205 directly into
   the Jetson, no hub.

### `error -71` (`device not accepting address`) in dmesg

USB enumeration failure. Almost always a cable/power issue:

```bash
sudo dmesg | grep -iE 'usb|enumerate|address'
```

Reseat the B205mini, try a different blue USB port, try a known-good
SuperSpeed cable.

### `No UHD Devices Found` (after `uhd_find_devices`)

```bash
# Check the radio is enumerated at all
lsusb | grep -E '2500|04b4'
# 2500:0022 = B205mini with FX3 firmware loaded (good)
# 04b4:00f3 = unprogrammed Cypress (UHD will load FX3 on first probe)

# If only sudo works, udev rules are not active — replug or:
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### Blue Dragon process spawns but no devices show up

```bash
# tshark missing or failed to spawn?
which tshark   # → /usr/bin/tshark
ps -ef | grep tshark    # should see it after Start

# FIFO hand-off broken?
ls -la /tmp/bd-live.fifo    # should be a named pipe (prw-rw-r--)
sudo fuser -v /tmp/bd-live.fifo   # blue-dragon (writer) + tshark (reader)
```

### 96-channel `--all-channels` mode captures 0 packets

Known limitation. The PFB (polyphase filter bank) channelizer for 96
channels @ full sample rate exceeds Jetson aarch64 CPU budget without
GPU acceleration. Blue Dragon's GPU path uses OpenCL, which Jetson
GPUs don't expose by default (CUDA only). Workarounds:

- Use 40-channel mode (default — leave ALL CH unchecked).
- Build with `--features "usrp,zmq,gps,gpu"` plus install
  `ocl-icd-opencl-dev` if you have an OpenCL ICD bridge.

### Vite HMR kills running blue-dragon (jetson-port behavior)

**Expected.** Argos's process-manager has an HMR-orphan reaper —
when you edit a server file mid-capture, Vite re-imports the module,
the new module instance reads `/tmp/argos-bluedragon.pid`, finds the
prior child still alive, and SIGKILLs it before serving the next
request. Click **Start** again to spawn fresh. Look for
`[bluedragon] reaping stale child from prior module load` in the
dev log to confirm.

### Hydration crash on `/dashboard` (`TypeError: ... unref ...`)

Already fixed in the Jetson port — see
`src/lib/utils/logger.ts:85`. The Node `setInterval(...).unref()`
call now has an optional-chained guard so the call is a no-op in the
client bundle.

---

## 11. Known limitations on Jetson

| Limitation                                 | Reason                                         | Workaround                                                   |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------ |
| Blue Dragon 96-ch mode CPU-bound           | No OpenCL ICD on Tegra GPU                     | Stay at 40 ch, or write a CUDA backend                       |
| Google Chrome unavailable                  | NVIDIA does not ship aarch64 Chrome            | Use snap Chromium with `--remote-debugging-port=9222`        |
| chrome-devtools-mcp plugin namespace fails | Plugin defaults to `/opt/google/chrome/chrome` | Use user-scope MCP with `--browserUrl http://127.0.0.1:9222` |
| Some power supplies under-spec             | Jetson AGX Orin draws ~50 W under load         | Use the bundled 90 W brick                                   |

---

## 12. Platform deltas vs Raspberry Pi 5 / Kali

| Item                          | RPi 5 / Kali                           | Jetson AGX Orin / jammy                          |
| ----------------------------- | -------------------------------------- | ------------------------------------------------ |
| `BD_BIN` default in code      | `/home/kali/Documents/Argos/Argos/...` | Must override via `.env`                         |
| `protoc` from package manager | Adequate                               | Too old (3.12) — install upstream 30.2           |
| Browser for chrome-devtools   | Chrome via apt                         | Snap Chromium + manual `--remote-debugging-port` |
| GPU PFB                       | OpenCL (recommended)                   | None working (CUDA bridge required)              |
| USB 3 enumeration             | "Just works"                           | Cable + port choice critical                     |
| CPU temp sensor path          | hwmon                                  | `/sys/class/thermal/thermal_zone*/temp` first    |
| HDMI boot                     | Direct                                 | May need `modprobe nvidia-drm`                   |
| sudo password                 | per environment                        | (deployment-specific)                            |

---

## 13. Repository layout note

This `argos-jetson` repo was forked from
[`Graveside2022/Argos`](https://github.com/Graveside2022/Argos) in
April 2026. Generic improvements made during the Jetson port (wideband
Bluetooth toggles, HMR-orphan reaper, spawn race fix, Zod schema
hardening, HttpError pass-through) apply to both platforms and should
be merged back upstream when stable.

Jetson-specific divergence lives here:

- `docs/install/jetson-aarch64.md` (this file)
- Future: CUDA-backed Blue Dragon GPU path, if/when implemented
- Future: `BD_BIN` default neutralized to a relative tactical path
