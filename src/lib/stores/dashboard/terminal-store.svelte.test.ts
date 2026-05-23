import { describe, expect, it } from 'vitest';

import {
	activeSession,
	closeSession,
	createSession,
	renameSession,
	setActiveSession,
	terminalPanelState,
	terminalSessions,
	toggleMaximize
} from './terminal-store.svelte';

describe('terminal-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('createSession adds a session + makes it active', () => {
		const id = createSession('scripts/tmux/tmux-0.sh');
		expect(terminalSessions.current.some((s) => s.id === id)).toBe(true);
		expect(activeSession.current?.id).toBe(id);
	});

	it('setActiveSession switches the active tab', () => {
		const a = createSession('scripts/tmux/tmux-0.sh');
		const b = createSession('scripts/tmux/tmux-1.sh');
		setActiveSession(a);
		expect(terminalPanelState.current.activeTabId).toBe(a);
		setActiveSession(b);
		expect(terminalPanelState.current.activeTabId).toBe(b);
	});

	it('renameSession updates the title', () => {
		const id = createSession('scripts/tmux/tmux-0.sh');
		renameSession(id, 'RENAMED');
		expect(terminalSessions.current.find((s) => s.id === id)?.title).toBe('RENAMED');
	});

	it('closeSession removes the session', () => {
		const id = createSession('scripts/tmux/tmux-0.sh');
		closeSession(id);
		expect(terminalSessions.current.some((s) => s.id === id)).toBe(false);
	});

	it('toggleMaximize flips isMaximized', () => {
		const before = terminalPanelState.current.isMaximized;
		toggleMaximize();
		expect(terminalPanelState.current.isMaximized).toBe(!before);
	});
});
