#!/usr/bin/env python3
"""
Argos Phase-2 patcher for /opt/wardragon-fpv-detect/scripts/fpv_energy_scan.py

Extends the scanner's ALL_CENTERS_MHZ list with WiFi ISM bands to broaden
the drone-signals detection surface from 58 analog FPV centers to 91 unique
centers. Idempotent — re-running is a no-op if the marker is already
present.

Invoked by scripts/ops/install-dragonsync.sh. Rationale + frequency
breakdown in ~/.claude/plans/next-task-1-use-purrfect-brooks.md (Phase 2).

Exits 0 on success (patched or already-patched); 2 if the target file
structure isn't what we expected (e.g. upstream refactored the constants).
"""

from __future__ import annotations

import pathlib
import sys

TARGET = pathlib.Path("/opt/wardragon-fpv-detect/scripts/fpv_energy_scan.py")
MARKER = "_ARGOS_EXTENDED_BANDS_MARKER"

# Line we replace. Must match upstream exactly.
ORIGINAL_LINE = "ALL_CENTERS_MHZ = sorted(set(RACE_BANDS_ALL_MHZ + EXTRA_59_MHZ))"

# Block we insert in its place — adds WIFI_ISM_MHZ + marker + extended
# ALL_CENTERS_MHZ. Centered on standards: IEEE 802.11 ch centers for
# WiFi 2.4 GHz, FCC Part 15 Subpart E for the U-NII sub-bands.
REPLACEMENT = """\
# ---------------------------------------------------------------------------
# Argos patch: widen detection surface beyond analog FPV video.
# De-duplicated via set() below; collisions with RACE_BANDS (e.g. 5200 MHz
# appears in both X low band and U-NII-1) are dropped.
# Sources: IEEE 802.11-2020 (WiFi channel centers), FCC Part 15 Subpart E
# (U-NII sub-bands). See ~/.claude/plans/next-task-1-use-purrfect-brooks.md.
# ---------------------------------------------------------------------------
WIFI_ISM_MHZ = [
    # 2.4 GHz WiFi (ch 1-14; 12-14 are EU/JP region-specific)
    2412, 2417, 2422, 2427, 2432, 2437, 2442, 2447, 2452, 2457, 2462,
    2467, 2472, 2484,
    # U-NII-1 (5.15-5.25 GHz)
    5180, 5200, 5220, 5240,
    # U-NII-2A (5.25-5.35 GHz)
    5260, 5280, 5300, 5320,
    # U-NII-2C DFS (5.47-5.725 GHz)
    5500, 5520, 5540, 5560, 5580, 5600, 5620, 5640, 5660, 5680, 5700, 5720,
]
_ARGOS_EXTENDED_BANDS_MARKER = True
ALL_CENTERS_MHZ = sorted(
    set(RACE_BANDS_ALL_MHZ + EXTRA_59_MHZ + WIFI_ISM_MHZ)
)"""


def main() -> int:
    if not TARGET.is_file():
        print(f"[patcher] Target not found: {TARGET}", file=sys.stderr)
        return 2

    src = TARGET.read_text()

    if MARKER in src:
        print(f"[patcher] Already patched ({MARKER} present) — skipping.")
        return 0

    if ORIGINAL_LINE not in src:
        print(
            f"[patcher] Expected line not found in {TARGET}:\n"
            f"          {ORIGINAL_LINE}\n"
            f"          Upstream may have refactored the constants block.",
            file=sys.stderr,
        )
        return 2

    patched = src.replace(ORIGINAL_LINE, REPLACEMENT, 1)
    TARGET.write_text(patched)
    print(f"[patcher] Patched {TARGET} — 91 unique centers (58 analog + 33 WiFi ISM).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
