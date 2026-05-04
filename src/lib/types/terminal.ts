/**
 * Type definitions for VS Code-style terminal panel
 */

/** Individual terminal session */
export interface TerminalSession {
	id: string;
	title: string;
	shell: string;
	isConnected: boolean;
	createdAt: number;
}

/** Split pane configuration */
export interface SplitPaneConfig {
	id: string;
	sessionIds: string[]; // Left to right
	widths: number[]; // Percentages (should sum to 100)
}

/** Terminal panel state */
export interface TerminalPanelState {
	isOpen: boolean;
	height: number; // Panel height in pixels
	activeTabId: string | null;
	sessions: TerminalSession[];
	splits: SplitPaneConfig | null; // null = no split, single terminal
	preferredShell: string;
	isMaximized: boolean;
}

/** Shell information from API */
export interface ShellInfo {
	path: string;
	name: string;
	isDefault: boolean;
}

/** API response for available shells */
export interface ShellsResponse {
	shells: ShellInfo[];
	defaultShell: string;
}
