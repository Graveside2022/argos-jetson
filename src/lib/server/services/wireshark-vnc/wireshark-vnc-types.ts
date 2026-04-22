/**
 * Type definitions and constants for the Wireshark VNC service.
 *
 * Spawns a three-process stack (Xtigervnc + Wireshark Qt GUI + websockify)
 * to stream the native GUI into the Argos dashboard via noVNC.
 *
 * Ports are offset from SDR++ (:97/5997/6082), Sparrow-WiFi (:98/5998/6081),
 * and WebTAK (:99/5999/6080) so all four stacks can run simultaneously.
 */

/** X display number used by Xtigervnc and Wireshark. */
export const WIRESHARK_VNC_DISPLAY = ':96';

/** TCP port where Xtigervnc serves the VNC protocol on localhost. */
export const WIRESHARK_VNC_PORT = 5996;

/** TCP port where websockify exposes the VNC session as a WebSocket. */
export const WIRESHARK_WS_PORT = 6083;

/** URL path segment served by websockify. */
export const WIRESHARK_WS_PATH = '/websockify';

/** Geometry passed to Xtigervnc (`WxH`). Matches SDR++ to give packet detail view breathing room. */
export const WIRESHARK_GEOMETRY = '1440x900';

/** Color depth for the virtual framebuffer. */
export const WIRESHARK_DEPTH = 24;

/** Path to the Wireshark Qt GUI binary. */
export const WIRESHARK_GUI_PATH = '/usr/bin/wireshark';

/** Default capture interface. `any` captures across all interfaces (needs dumpcap CAP_NET_RAW). */
export const WIRESHARK_DEFAULT_IFACE = 'any';

/** Default display filter. Drop noisy ARP so the capture pane is readable on first frame. */
export const WIRESHARK_DEFAULT_FILTER = 'not arp';

/** Wireshark config profile used to isolate read-only overrides from the user's default profile. */
export const WIRESHARK_PROFILE = 'ArgosReadOnly';

/** Result returned from every control action (start/stop/status). */
export interface WiresharkVncControlResult {
	success: boolean;
	message: string;
	error?: string;
	wsPort?: number;
	wsPath?: string;
	iface?: string;
	filter?: string;
}

/** Result returned from the status action. */
export interface WiresharkVncStatusResult {
	success: true;
	isRunning: boolean;
	status: 'active' | 'inactive';
	wsPort: number;
	wsPath: string;
	iface: string | null;
	filter: string | null;
}
