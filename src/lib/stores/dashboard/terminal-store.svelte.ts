/**
 * Terminal panel store for VS Code-style terminal management.
 * Handles session state, panel visibility, and persistence.
 *
 * Phase 3 / ADR-0003: migrated from `svelte/store` (`persistedWritable` +
 * `derived`) to the rune state layer. State is a `persistedState`; mutators
 * read `.current` and `.set()` the next value; `terminalSessions`/`activeSession`
 * are getter accessors. `activeBottomTab` is read via `.current` now that
 * dashboard-store is rune-based too.
 */

import { persistedState } from '$lib/state/persisted.svelte';
import type { TerminalPanelState, TerminalSession } from '$lib/types/terminal';
import { logger } from '$lib/utils/logger';

import { activeBottomTab, closeBottomPanel } from './dashboard-store.svelte';
import {
	createNewSession,
	removeSplitSession,
	resolveActiveTab,
	TMUX_SHELLS
} from './terminal-session-helpers';

const STORAGE_KEY = 'terminalPanelState';
const DEFAULT_HEIGHT = 300;

/** Default terminal panel state */
function getDefaultState(): TerminalPanelState {
	return {
		isOpen: false,
		height: DEFAULT_HEIGHT,
		activeTabId: null,
		sessions: [],
		splits: null,
		preferredShell: 'scripts/tmux/tmux-0.sh',
		isMaximized: false
	};
}

/** Restore sessions as disconnected and rebuild state from parsed localStorage data. */
function restoreSessions(parsed: Record<string, unknown>): TerminalSession[] {
	return ((parsed.sessions as TerminalSession[]) ?? []).map((s) => ({
		...s,
		isConnected: false
	}));
}

/** Build restored terminal state from parsed data and sessions. */
// fallow-ignore-next-line complexity
function buildRestoredState(
	parsed: Record<string, unknown>,
	sessions: TerminalSession[]
): TerminalPanelState {
	return {
		...getDefaultState(),
		height: (parsed.height as number) ?? DEFAULT_HEIGHT,
		preferredShell: (parsed.preferredShell as string) ?? '',
		sessions,
		activeTabId: sessions[0]?.id ?? null,
		isMaximized: false
	};
}

/** Deserialize terminal state from localStorage JSON. */
function deserializeTerminalState(raw: string): TerminalPanelState {
	const parsed = JSON.parse(raw);
	const sessions = restoreSessions(parsed);
	if (sessions.length > 0) {
		logger.info('Restoring terminal sessions', { sessionCount: sessions.length });
		setTimeout(() => activeBottomTab.set('terminal'), 0);
	}
	return buildRestoredState(parsed, sessions);
}

/** Main terminal panel state — persists height, preferredShell, sessions to localStorage */
export const terminalPanelState = persistedState<TerminalPanelState>(
	STORAGE_KEY,
	getDefaultState(),
	{
		serialize: (state) =>
			JSON.stringify({
				height: state.height,
				preferredShell: state.preferredShell,
				sessions: state.sessions
			}),
		deserialize: deserializeTerminalState
	}
);

// Getter accessors for convenience (replace the legacy `derived` stores).
export const terminalSessions = {
	get current() {
		return terminalPanelState.current.sessions;
	}
};

export const activeSession = {
	get current() {
		const state = terminalPanelState.current;
		if (!state.activeTabId) return null;
		return state.sessions.find((s) => s.id === state.activeTabId) ?? null;
	}
};

// Panel visibility functions
function openTerminalPanel(): void {
	const state = terminalPanelState.current;
	if (state.sessions.length === 0) {
		const newSession = createNewSession(state.preferredShell || '/bin/zsh');
		terminalPanelState.set({
			...state,
			isOpen: true,
			sessions: [newSession],
			activeTabId: newSession.id
		});
	} else {
		terminalPanelState.set({ ...state, isOpen: true });
	}
	activeBottomTab.set('terminal');
}

export function closeTerminalPanel(): void {
	terminalPanelState.set({ ...terminalPanelState.current, isOpen: false });
	closeBottomPanel();
}

export function toggleTerminalPanel(): void {
	if (activeBottomTab.current === 'terminal') closeTerminalPanel();
	else openTerminalPanel();
}

function pickShell(state: TerminalPanelState, shell?: string): string {
	if (shell) return shell;
	const openShells = new Set(state.sessions.map((s) => s.shell));
	const nextShell = TMUX_SHELLS.find((s) => !openShells.has(s));
	return nextShell || state.preferredShell || '/bin/zsh';
}

export function createSession(shell?: string): string {
	const state = terminalPanelState.current;
	const newSession = createNewSession(pickShell(state, shell));
	terminalPanelState.set({
		...state,
		sessions: [...state.sessions, newSession],
		activeTabId: newSession.id,
		isOpen: true
	});
	return newSession.id;
}

export function closeSession(sessionId: string): void {
	const state = terminalPanelState.current;
	const newSessions = state.sessions.filter((s) => s.id !== sessionId);
	terminalPanelState.set({
		...state,
		sessions: newSessions,
		activeTabId: resolveActiveTab(state, sessionId, newSessions),
		splits: removeSplitSession(state.splits, sessionId)
	});
}

export function setActiveSession(sessionId: string): void {
	const state = terminalPanelState.current;
	if (state.sessions.some((s) => s.id === sessionId)) {
		terminalPanelState.set({ ...state, activeTabId: sessionId });
	}
}

export function renameSession(sessionId: string, newTitle: string): void {
	const state = terminalPanelState.current;
	terminalPanelState.set({
		...state,
		sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
	});
}

export function updateSessionConnection(sessionId: string, isConnected: boolean): void {
	const state = terminalPanelState.current;
	terminalPanelState.set({
		...state,
		sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, isConnected } : s))
	});
}

// Panel sizing — delegates to shared bottom panel height
export function toggleMaximize(): void {
	const state = terminalPanelState.current;
	terminalPanelState.set({ ...state, isMaximized: !state.isMaximized });
}

// Split pane management
export function unsplit(): void {
	terminalPanelState.set({ ...terminalPanelState.current, splits: null });
}

// Navigation helpers
export function nextTab(): void {
	const state = terminalPanelState.current;
	if (state.sessions.length <= 1) return;
	const currentIndex = state.sessions.findIndex((s) => s.id === state.activeTabId);
	const nextIndex = (currentIndex + 1) % state.sessions.length;
	terminalPanelState.set({ ...state, activeTabId: state.sessions[nextIndex].id });
}

export function previousTab(): void {
	const state = terminalPanelState.current;
	if (state.sessions.length <= 1) return;
	const currentIndex = state.sessions.findIndex((s) => s.id === state.activeTabId);
	const prevIndex = (currentIndex - 1 + state.sessions.length) % state.sessions.length;
	terminalPanelState.set({ ...state, activeTabId: state.sessions[prevIndex].id });
}
