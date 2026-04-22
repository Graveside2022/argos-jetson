#!/usr/bin/env python3
"""
Argos C2 Scanner — HackRF sub-GHz sweep for drone command-and-control links.

Complements wardragon-fpv-detect (B205, 92 centers, 5 GHz FPV video). This
scanner uses the HackRF One to sweep the sub-GHz drone-C2 bands: 433 ISM,
868 ISM, 915 ISM, 1.2-1.3 GHz legacy video, and GPS L1 (for jammer detection).

Channel centers derived from:
  - ExpressLRS FHSS domain table (src/lib/FHSS/FHSS.cpp master @ 2026-04-08)
  - TBS Crossfire 868/915 spec
  - SiK MAVLink telemetry radio defaults
  - ArduPilot wiki SiK advanced config
  - Commercial counter-UAS band lists (CRFS, D-Fend)

Publishes JSON alerts on ZMQ XPUB (default tcp://127.0.0.1:4227) in a schema
compatible with DragonSync's _parse_fpv_alert (Basic ID + Location/Vector +
Self-ID + Frequency + Signal Info blocks), with source="c2-energy".

Differences vs wardragon-fpv-detect:
  - samp_rate 2 MHz (not 8) — narrowband C2 signals are 0.5-1.6 MHz wide
  - MIN_BW_HZ 300 kHz (not 4 MHz) — catches ELRS/SiK packets
  - 11 centers (not 92) — sub-GHz only
  - HackRF osmosdr args (not UHD B200)
  - No suscli confirm step (C2 links don't PAL/NTSC modulate)
  - No DJI guard (B205 not involved)
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import statistics
import time
from typing import Optional, Tuple

import pmt
import zmq
from gnuradio import gr, blocks
from gnuradio.fft import window
import osmosdr

try:
    from gnuradio import inspector
except ImportError:
    from gnuradio import inspector  # noqa: F401

# Sub-GHz drone C2 centers (MHz) — one or two centers per ISM band, chosen
# to let 2 MHz analysis BW blanket the full ELRS/TBS FHSS range per band.
C2_CENTERS_MHZ = [
    # 433 ISM (ELRS US433W 423.5-438, EU433 433.1-434.45, SiK 433, DragonLink)
    430, 434, 437,
    # 70cm / Microhard P400 (400-470 MHz) — MH P400 C2, amateur 70cm telemetry
    447, 460,
    # 868 ISM (ELRS EU868 863.275-869.575, TBS Crossfire EU, SiK 868)
    866, 869,
    # 915 ISM (ELRS FCC915 903.5-926.9, AU915 915.5-926.9, TBS US, FrSky R9, SiK 915)
    907, 914, 921, 926,
    # 1.2-1.3 GHz legacy analog FPV video (pre-5.8 GHz era; niche but active)
    1260, 1280,
    # GPS L1 — detect jammers/spoofers (narrowband ±2 MHz around 1575.42)
    1575,
    # Iridium L-band uplink 1616-1626 MHz — satellite-linked BVLOS drones (Rockblock etc)
    1620,
]

SAMP_RATE = 2e6
BANDWIDTH = 2e6
GAIN = 40
FFT_LEN = 2048
AUTO_THRESHOLD = False
SENSITIVITY = 0.6
THRESHOLD_DB = -90.0
AVERAGE = 0.5
QUANTIZATION = 0.05
MIN_BW_HZ = 300e3
SETTLE_S = 0.15
DWELL_S = 0.5
WARMUP_SWEEPS = 1
THRESHOLD_OFFSET_DB = 6.0

C2_ZMQ_ENDPOINT = os.getenv("C2_ZMQ_ENDPOINT", "tcp://127.0.0.1:4227")
MON_ZMQ_ENDPOINT = os.getenv("WARD_MON_ZMQ", "tcp://127.0.0.1:4225")
MON_ZMQ_RECV_TIMEOUT_MS = int(os.getenv("WARD_MON_RECV_TIMEOUT_MS", "50"))
ALERT_ID_PREFIX = "c2-alert"

_last_sensor_gps: Optional[Tuple[float, float, float]] = None


class C2Scan(gr.top_block):
    def __init__(self, threshold_db, source_args, samp_rate, bandwidth, gain):
        super().__init__()
        self.src = osmosdr.source(source_args)
        self.src.set_sample_rate(samp_rate)
        self.src.set_center_freq(C2_CENTERS_MHZ[0] * 1e6)
        self.src.set_bandwidth(bandwidth)
        self.src.set_gain(gain)

        self.detector = inspector.signal_detector_cvf(
            samp_rate,
            FFT_LEN,
            window.WIN_BLACKMAN_hARRIS,
            threshold_db,
            SENSITIVITY,
            AUTO_THRESHOLD,
            AVERAGE,
            QUANTIZATION,
            MIN_BW_HZ,
            "",
        )

        self.null = blocks.null_sink(gr.sizeof_float * FFT_LEN)
        self.msg_dbg = blocks.message_debug()
        self.probe = blocks.probe_signal_vf(FFT_LEN)

        self.connect(self.src, self.detector)
        self.connect((self.detector, 0), self.null)
        self.connect((self.detector, 0), self.probe)
        self.msg_connect((self.detector, "map_out"), (self.msg_dbg, "store"))

    def set_center(self, hz):
        self.src.set_center_freq(hz)

    def get_latest_map(self):
        count = self.msg_dbg.num_messages()
        if count == 0:
            return None
        return self.msg_dbg.get_message(count - 1)

    def get_latest_spectrum(self):
        return self.probe.level()


def parse_rf_map(msg, center_hz):
    signals = []
    if msg is None:
        return signals
    for i in range(pmt.length(msg)):
        row = pmt.vector_ref(msg, i)
        freq_off = pmt.f32vector_ref(row, 0)
        bw = pmt.f32vector_ref(row, 1)
        abs_hz = center_hz + freq_off
        if bw >= MIN_BW_HZ:
            signals.append((abs_hz, bw))
    return signals


def is_valid_latlon(lat, lon):
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return False
    return -90.0 <= float(lat) <= 90.0 and -180.0 <= float(lon) <= 180.0


def setup_monitor_sub(endpoint):
    try:
        ctx = zmq.Context.instance()
        sub = ctx.socket(zmq.SUB)
        sub.setsockopt(zmq.SUBSCRIBE, b"")
        sub.setsockopt(zmq.RCVTIMEO, MON_ZMQ_RECV_TIMEOUT_MS)
        sub.connect(endpoint)
        return sub
    except Exception:
        return None


def poll_monitor_for_gps(sub_sock):
    global _last_sensor_gps
    if sub_sock is None:
        return
    try:
        msg = sub_sock.recv_string(flags=zmq.NOBLOCK)
    except zmq.Again:
        return
    except Exception:
        return

    try:
        payload = json.loads(msg)
    except json.JSONDecodeError:
        return

    lat = payload.get("lat")
    lon = payload.get("lon")
    alt = payload.get("alt", 0.0)
    if is_valid_latlon(lat, lon):
        _last_sensor_gps = (float(lat), float(lon), float(alt))


def band_label(freq_mhz: float) -> str:
    if 420 <= freq_mhz < 440:
        return "433 ISM"
    if 440 <= freq_mhz < 470:
        return "70cm / Microhard P400"
    if 860 <= freq_mhz < 875:
        return "868 ISM"
    if 900 <= freq_mhz < 930:
        return "915 ISM"
    if 1240 <= freq_mhz < 1300:
        return "1.2-1.3 GHz legacy video"
    if 1570 <= freq_mhz < 1580:
        return "GPS L1"
    if 1610 <= freq_mhz < 1630:
        return "Iridium L-band"
    return "unknown"


def build_alert_messages(center_hz, bandwidth_hz, rssi_linear, source):
    message_list = []
    freq_mhz = center_hz / 1e6
    alert_id = f"{ALERT_ID_PREFIX}-{freq_mhz:.3f}MHz"
    label = band_label(freq_mhz)

    message_list.append({
        "Basic ID": {
            "id_type": "Serial Number (ANSI/CTA-2063-A)",
            "id": alert_id,
            "description": f"Drone C2 Signal ({label})",
        }
    })

    if _last_sensor_gps is not None:
        lat, lon, alt = _last_sensor_gps
        message_list.append({
            "Location/Vector Message": {
                "latitude": lat,
                "longitude": lon,
                "geodetic_altitude": alt,
                "height_agl": 0.0,
                "speed": 0.0,
                "vert_speed": 0.0,
            }
        })

    message_list.append({
        "Self-ID Message": {"text": f"C2 alert ({source}, {label})"}
    })

    message_list.append({"Frequency Message": {"frequency": center_hz}})

    message_list.append({
        "Signal Info": {
            "source": source,
            "center_hz": center_hz,
            "bandwidth_hz": bandwidth_hz,
            "rssi": rssi_linear,
            "band": label,
        }
    })

    return message_list


def warmup_threshold(tb):
    time.sleep(0.5)
    medians = []
    for _ in range(3):
        time.sleep(0.2)
        spectrum = tb.get_latest_spectrum()
        if spectrum:
            try:
                medians.append(statistics.median(spectrum))
            except statistics.StatisticsError:
                continue
    if not medians:
        return THRESHOLD_DB
    return statistics.median(medians) + THRESHOLD_OFFSET_DB


def parse_args():
    p = argparse.ArgumentParser(description="Argos C2 scanner — sub-GHz sweep on HackRF.")
    p.add_argument("-z", "--zmq", action="store_true", help="Enable ZMQ XPUB output.")
    p.add_argument("--zmq-endpoint", default=C2_ZMQ_ENDPOINT)
    p.add_argument("--monitor-endpoint", default=MON_ZMQ_ENDPOINT)
    p.add_argument("-d", "--debug", action="store_true")
    p.add_argument("--osmosdr-args", default="hackrf,bias=0")
    p.add_argument("--samp-rate", type=float, default=SAMP_RATE)
    p.add_argument("--bandwidth", type=float, default=BANDWIDTH)
    p.add_argument("--gain", type=float, default=GAIN)
    return p.parse_args()


def main():
    args = parse_args()

    pub = None
    if args.zmq:
        ctx = zmq.Context.instance()
        pub = ctx.socket(zmq.XPUB)
        pub.setsockopt(zmq.XPUB_VERBOSE, True)
        pub.bind(args.zmq_endpoint)

    mon_sub = setup_monitor_sub(args.monitor_endpoint)

    threshold_db = THRESHOLD_DB
    tb = C2Scan(threshold_db, args.osmosdr_args, args.samp_rate, args.bandwidth, args.gain)
    tb.start()
    if WARMUP_SWEEPS > 0 and not AUTO_THRESHOLD:
        threshold_db = warmup_threshold(tb)
        if args.debug:
            print(f"debug: c2 warmup threshold={threshold_db:.2f} dB")
        tb.stop()
        tb.wait()
        tb = C2Scan(threshold_db, args.osmosdr_args, args.samp_rate, args.bandwidth, args.gain)
        tb.start()

    try:
        # Per-sweep heartbeat so "silent because no detects" is distinguishable
        # from "process wedged" in journalctl. Emits one line every full
        # C2_CENTERS_MHZ pass (~15 centers x (SETTLE_S + DWELL_S) ≈ 10-15s).
        sweep_count = 0
        while True:
            sweep_start = time.monotonic()
            cycle_detections = 0
            for center_mhz in C2_CENTERS_MHZ:
                center_hz = int(center_mhz * 1e6)
                tb.set_center(center_hz)
                time.sleep(SETTLE_S)
                poll_monitor_for_gps(mon_sub)
                time.sleep(DWELL_S)

                rf_map = tb.get_latest_map()
                detections = parse_rf_map(rf_map, center_hz)
                cycle_detections += len(detections)

                if args.debug and detections:
                    print(f"debug: center={center_mhz} MHz detections={len(detections)}")

                for abs_hz, bw in detections:
                    spec = tb.get_latest_spectrum() or []
                    rssi_linear = float(statistics.mean(spec)) if spec else 0.0
                    alert = build_alert_messages(
                        center_hz=int(abs_hz),
                        bandwidth_hz=int(bw),
                        rssi_linear=rssi_linear,
                        source="c2-energy",
                    )
                    if pub is not None:
                        try:
                            pub.send_string(json.dumps(alert))
                        except Exception as e:
                            if args.debug:
                                print(f"debug: zmq send failed: {e}")

                gc.collect()

            sweep_count += 1
            dt = time.monotonic() - sweep_start
            print(
                f"c2-scanner: sweep #{sweep_count} ({len(C2_CENTERS_MHZ)} centers, "
                f"{dt:.1f}s, {cycle_detections} detection{'s' if cycle_detections != 1 else ''})",
                flush=True,
            )
    except KeyboardInterrupt:
        pass
    finally:
        tb.stop()
        tb.wait()


if __name__ == "__main__":
    main()
