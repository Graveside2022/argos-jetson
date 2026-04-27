#!/usr/bin/env python3
"""Argos B205 spectrum sidecar — emits NDJSON spectrum frames on stdout.

Spawned by src/lib/server/spectrum/b205-source.ts. One JSON object per FFT
window written line-delimited to stdout. SIGTERM stops cleanly via the
UHD continuous-streaming teardown (StreamMode.stop_cont).

Authoritative references:
  - https://files.ettus.com/manual/page_usrp_b200.html
    (recv_frame_size tuning hint, master_clock_rate range)
  - https://files.ettus.com/manual/page_python.html
    (Python API mirrors C++ multi_usrp surface)
  - https://github.com/EttusResearch/uhd/blob/master/host/examples/python/rx_spectrum_to_asciiplot.py
    (canonical continuous-rx FFT pattern: StreamMode.start_cont/stop_cont,
    RXMetadata.error_code dispatch, hamming + log10 PSD)

Anti-overflow device-args from prior Argos work (see memory
project_uas_phase3_overflow_fix): num_recv_frames=512 + recv_frame_size=8192
+ master_clock_rate=16e6 eliminated B205 overflows during UAS Phase 3.
"""

import argparse
import json
import signal
import sys
import time

import numpy as np
import uhd

DEVICE_ARGS = (
    "type=b200,master_clock_rate=16e6,num_recv_frames=512,recv_frame_size=8192"
)

_running = True


def _sigterm(_signum, _frame):
    global _running  # noqa: PLW0603 — module-level flag is the standard signal pattern
    _running = False


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--center", type=float, required=True, help="Center freq (Hz)")
    p.add_argument("--rate", type=float, required=True, help="Sample rate (S/s)")
    p.add_argument("--gain", type=float, default=40.0, help="RX gain (dB)")
    p.add_argument("--bin-width", type=float, default=100_000.0, help="FFT bin width (Hz)")
    p.add_argument("--channel", type=int, default=0)
    return p.parse_args()


def next_pow2(x: int) -> int:
    return 1 << max(0, (x - 1).bit_length())


def psd(samples: np.ndarray, nfft: int) -> np.ndarray:
    """Power spectral density in relative dB.

    Matches EttusResearch/uhd:host/examples/python/rx_spectrum_to_pyplot.py psd().
    The +3 dB term corrects the single-sided FFT for real-input bias.
    """
    window = np.hamming(nfft)
    fft = np.fft.fftshift(np.fft.fft(samples * window))
    window_power = float(np.sum(window * window) / nfft)
    return (
        20 * np.log10(np.abs(fft) + 1e-12)
        - 10 * np.log10(window_power)
        - 20 * np.log10(nfft)
        + 3
    )


def main() -> int:
    args = parse_args()

    signal.signal(signal.SIGTERM, _sigterm)
    signal.signal(signal.SIGINT, _sigterm)

    nfft = next_pow2(max(64, int(round(args.rate / args.bin_width))))

    usrp = uhd.usrp.MultiUSRP(DEVICE_ARGS)
    usrp.set_rx_rate(args.rate, args.channel)
    usrp.set_rx_freq(uhd.types.TuneRequest(args.center), args.channel)
    usrp.set_rx_gain(args.gain, args.channel)

    actual_rate = usrp.get_rx_rate()
    actual_freq = usrp.get_rx_freq(args.channel)

    st_args = uhd.usrp.StreamArgs("fc32", "sc16")
    st_args.channels = [args.channel]
    streamer = usrp.get_rx_stream(st_args)
    buf_samps = streamer.get_max_num_samps()
    recv_buffer = np.zeros((1, buf_samps), dtype=np.complex64)
    metadata = uhd.types.RXMetadata()

    frame_buf = np.empty((1, nfft), dtype=np.complex64)

    start_cmd = uhd.types.StreamCMD(uhd.types.StreamMode.start_cont)
    start_cmd.stream_now = True
    streamer.issue_stream_cmd(start_cmd)

    try:
        while _running:
            collected = 0
            while collected < nfft and _running:
                got = streamer.recv(recv_buffer, metadata)
                if metadata.error_code != uhd.types.RXMetadataErrorCode.none:
                    print(f"# uhd: {metadata.strerror()}", file=sys.stderr, flush=True)
                if got:
                    take = min(nfft - collected, got)
                    frame_buf[:, collected : collected + take] = recv_buffer[:, 0:take]
                    collected += take
            if not _running:
                break
            bins = psd(frame_buf[args.channel], nfft).astype(float).tolist()
            half = actual_rate / 2.0
            payload = {
                "ts": int(time.time() * 1000),
                "startFreq": float(actual_freq - half),
                "endFreq": float(actual_freq + half),
                "power": bins,
            }
            sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
            sys.stdout.flush()
    finally:
        stop_cmd = uhd.types.StreamCMD(uhd.types.StreamMode.stop_cont)
        try:
            streamer.issue_stream_cmd(stop_cmd)
        except Exception:  # noqa: BLE001 — best-effort cleanup; nothing useful to do on teardown failure
            pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
