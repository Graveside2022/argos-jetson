/**
 * Type definitions and constants for the GNSS-SDR + RTKLIB VNC service.
 *
 * Spawns a six-process stack to give the operator a software GNSS receiver
 * visualised live in the dashboard:
 *
 *   Xtigervnc   — virtual X display :98
 *   gnss-sdr    — headless CLI, ingests B205mini IQ, emits NMEA + RTCM
 *   rtknavi_qt  — RTKLIB Qt5 real-time nav, reads RTCM via tcpcli://:2101
 *   rtkplot_qt  — RTKLIB Qt5 sky-plot + signal bars, reads NMEA fifo
 *   websockify  — bridges VNC port to a WebSocket for noVNC
 *   socat       — bridges /tmp/argos-gnss-sdr.nmea → tcp://localhost:50001
 *                 so the system gpsd daemon (configured at host setup with
 *                 GPSD_OPTIONS="-n tcp://localhost:50001") picks the SDR
 *                 stream up as a secondary GPS source. Tactical map + kismet
 *                 geo automatically fail over to the SDR fix when the
 *                 hardware GMOUSE is jammed or unplugged.
 *
 * Ports are offset from the other VNC stacks (SDR++ :97 / 5997 / 6082,
 * WebTAK :96 / 5996 / 6081, Sparrow :95 / 5995 / 6080) so all stacks can
 * coexist.
 */

/** X display number used by Xtigervnc and the Qt5 GUIs. */
export const GNSS_SDR_VNC_DISPLAY = ':98';

/** TCP port where Xtigervnc serves the VNC protocol on localhost. */
export const GNSS_SDR_VNC_PORT = 5998;

/** TCP port where websockify exposes the VNC session as a WebSocket. */
export const GNSS_SDR_WS_PORT = 6083;

/** URL path segment served by websockify. */
export const GNSS_SDR_WS_PATH = '/websockify';

/**
 * Geometry passed to Xtigervnc (`WxH`). 1920x1080 = 16:9 — matches the typical
 * Argos dashboard panel aspect, so noVNC's `scaleViewport` letterboxes cleanly
 * without squishing the two tiled Qt windows. Wider than SDR++'s 1440x900 since
 * we host TWO native GUIs side-by-side (rtknavi_qt + gnss-sdr-monitor) and need
 * ~960 px per window to fit their default layouts.
 */
export const GNSS_SDR_GEOMETRY = '1920x1080';

/** Pixel width of the Xtigervnc framebuffer (kept in sync with GNSS_SDR_GEOMETRY). */
export const GNSS_SDR_FB_WIDTH = 1920;

/** Pixel height of the Xtigervnc framebuffer (kept in sync with GNSS_SDR_GEOMETRY). */
export const GNSS_SDR_FB_HEIGHT = 1080;

/** Color depth for the virtual framebuffer. */
export const GNSS_SDR_DEPTH = 24;

/** Path to the gnss-sdr binary built from source by Phase 1. */
export const GNSS_SDR_BIN = '/usr/local/bin/gnss-sdr';

/**
 * Wrapper shell script shipped by gnss-sdr (`utils/scripts/gnss-sdr-harness.sh`).
 * Re-executes the child whenever it exits with code 42, which is how the
 * telecommand `reset` command signals a clean restart while keeping the
 * harness PID stable. Installed at host setup time.
 */
export const GNSS_SDR_HARNESS_BIN = '/usr/local/bin/gnss-sdr-harness.sh';

/** RTKLIB rtknavi_qt — real-time PVT + DOP + numeric position panel + future RTK base-station support. */
export const RTKNAVI_QT_BIN = '/usr/local/bin/rtknavi_qt';

/**
 * gnss-sdr-monitor — Qt5 GUI from acebrianjuan/gnss-sdr-monitor that
 * consumes gnss-sdr's native Monitor block protobuf stream over UDP
 * (port {@link GNSS_SDR_MONITOR_UDP_PORT}). Shows per-SV C/N₀ bars,
 * 4-constellation sky-plot, per-channel acquisition/tracking state —
 * the receiver-internal view that surfaces jam/spoof signals. Replaces
 * RTKLIB's `rtkplot_qt` (which gave a generic survey-grade plot) with
 * a tool purpose-built for gnss-sdr's telemetry.
 */
export const GNSS_SDR_MONITOR_BIN = '/usr/local/bin/gnss-sdr-monitor';

/** socat for the NMEA→gpsd TCP bridge. */
export const SOCAT_BIN = '/usr/bin/socat';

/**
 * LD_PRELOAD path forced when spawning `gnss-sdr`.
 *
 * Ubuntu jammy ships two libuhd versions side-by-side: the older 4.1.0 (the
 * one apt's `libgnuradio-uhd` was compiled against) and the newer 4.10.0
 * (default link target for our source-built gnss-sdr binary). Loading gnss-sdr
 * against 4.10.0 triggers the gr-uhd component to abort at startup with an
 * "ABI compatibility mismatch" warning followed by exit code 1. Forcing the
 * older library at runtime via LD_PRELOAD restores ABI parity with the apt
 * gnuradio plugin without re-building anything.
 *
 * Verified 2026-05-27: `LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libuhd.so.4.1.0
 * uhd_find_devices --args type=b200` resolves the B205mini cleanly; gnss-sdr
 * boots past the gr-uhd init step.
 */
export const GNSS_SDR_LD_PRELOAD_LIBUHD = '/usr/lib/aarch64-linux-gnu/libuhd.so.4.1.0';

/** Directory holding the generated gnss-sdr.conf + RTKLIB .ini files. */
export const GNSS_SDR_CONF_DIR = '/var/lib/argos/gnss-sdr';

/** Named pipe gnss-sdr writes NMEA to; socat tails it and forwards over TCP. */
export const GNSS_SDR_NMEA_FIFO = '/tmp/argos-gnss-sdr.nmea';

/** TCP port socat listens on; gpsd is preconfigured to read tcp://localhost:50001. */
export const GNSS_SDR_NMEA_BRIDGE_PORT = 50001;

/** RTCM TCP server port spawned inside gnss-sdr's PVT block (PVT.rtcm_tcp_port). */
export const GNSS_SDR_RTCM_PORT = 2101;

/** UDP port for gnss-sdr's internal Monitor block (protobuf telemetry). Reserved for future panel. */
export const GNSS_SDR_MONITOR_UDP_PORT = 1234;

/** TCP port for gnss-sdr's telecommand interface (runtime control: reset/standby/warmstart/etc). */
export const GNSS_SDR_TELECOMMAND_PORT = 3333;

/** Telecommand client default localhost (always loopback — never expose externally). */
export const GNSS_SDR_TELECOMMAND_HOST = '127.0.0.1';

/** Whitelisted telecommand verbs (drop everything else as a precaution). */
export type GnssSdrTelecommand = 'reset' | 'standby' | 'coldstart' | 'hotstart' | 'warmstart';

/** Response shape from the telecommand API helper. */
export interface GnssSdrTelecommandResult {
	success: boolean;
	command: string;
	response: string;
	error?: string;
}

/** Owner string passed to resourceManager.acquire(...) for B205 mutex. */
export const GNSS_SDR_OWNER = 'gnss-sdr';

/** Constellations the operator can choose from the advanced form. */
export type ConstellationSet = 'L1_GPS_ONLY' | 'MULTI_L1';

/** Options accepted by the start action. Mirrors fields surfaced by the advanced form. */
export interface GnssSdrStartOptions {
	/** Constellation set to track. Defaults to L1_GPS_ONLY for fastest first fix on Jetson. */
	constellations?: ConstellationSet;
	/** UHD sampling rate in samples/sec. Defaults to 4 MS/s (L1 only) or 8 MS/s (multi). */
	sampleRate?: number;
	/** Total RX gain in dB. Defaults to 50. */
	gain?: number;
	/**
	 * USRP serial number used to filter UHD device discovery. Required for
	 * USB-attached B-series radios because v0.0.21's UHD signal source wraps
	 * `device_address` as `addr=` (Ethernet IP/hostname) which fails when the
	 * B205mini is on USB. Setting `device_serial` instead populates UHD's
	 * `serial=` filter — UHD's USB transport then targets a specific radio
	 * without firing the X300 Ethernet probe (which itself triggers a DNS
	 * lookup that aborts the start when no DNS is reachable).
	 *
	 * When left undefined, the auto-detector in spawnStackProcesses probes
	 * `uhd_find_devices` once and pins the discovered serial.
	 */
	deviceSerial?: string;
}

/** Result returned from every control action (start/stop/status). */
export interface GnssSdrVncControlResult {
	success: boolean;
	message: string;
	error?: string;
	wsPort?: number;
	wsPath?: string;
}

/** Result returned from the status action. */
export interface GnssSdrVncStatusResult {
	success: true;
	isRunning: boolean;
	status: 'active' | 'inactive';
	wsPort: number;
	wsPath: string;
}
