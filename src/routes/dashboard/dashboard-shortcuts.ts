/**
 * Dashboard keyboard shortcuts. Extracted from +page.svelte so the page
 * orchestrator no longer owns the shortcut table + matcher + Escape logic.
 * +page wires `<svelte:window onkeydown={handleDashboardKeydown} />`.
 */
import { get } from 'svelte/store';

import {
	activePanel,
	activeView,
	closeBottomPanel,
	isBottomPanelOpen
} from '$lib/stores/dashboard/dashboard-store';
import {
	createSession,
	nextTab,
	previousTab,
	toggleTerminalPanel
} from '$lib/stores/dashboard/terminal-store';

type ShortcutEntry = { ctrl: boolean; shift: boolean; key: string; action: () => void };

const SHORTCUTS: ShortcutEntry[] = [
	{ ctrl: true, shift: false, key: '`', action: toggleTerminalPanel },
	{ ctrl: true, shift: true, key: '`', action: createSession },
	{ ctrl: true, shift: true, key: '[', action: previousTab },
	{ ctrl: true, shift: true, key: ']', action: nextTab }
];

function matchShortcut(e: KeyboardEvent): ShortcutEntry | undefined {
	return SHORTCUTS.find((s) => e.ctrlKey === s.ctrl && e.shiftKey === s.shift && e.key === s.key);
}

/** Escape: collapse the bottom panel, else leave a tool view, else close a panel. */
function handleEscape(): void {
	if (get(isBottomPanelOpen)) closeBottomPanel();
	else if (get(activeView) !== 'map') activeView.set('map');
	else if (get(activePanel) !== null) activePanel.set(null);
}

export function handleDashboardKeydown(e: KeyboardEvent): void {
	const shortcut = matchShortcut(e);
	if (shortcut) {
		e.preventDefault();
		shortcut.action();
		return;
	}
	if (e.key === 'Escape') handleEscape();
}
