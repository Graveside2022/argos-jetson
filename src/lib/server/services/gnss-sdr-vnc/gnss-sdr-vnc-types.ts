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

/** Geometry passed to Xtigervnc (`WxH`). Matches SDR++ for consistency. */
export const GNSS_SDR_GEOMETRY = '1440x900';

/** Color depth for the virtual framebuffer. */
export const GNSS_SDR_DEPTH = 24;

/** Path to the gnss-sdr binary built from source by Phase 1. */
export const GNSS_SDR_BIN = '/usr/local/bin/gnss-sdr';

/** RTKLIB Qt5 binary paths (built from rtklibexplorer/RTKLIB). */
export const RTKNAVI_QT_BIN = '/usr/local/bin/rtknavi_qt';
export const RTKPLOT_QT_BIN = '/usr/local/bin/rtkplot_qt';

/** socat for the NMEA→gpsd TCP bridge. */
export const SOCAT_BIN = '/usr/bin/socat';

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
