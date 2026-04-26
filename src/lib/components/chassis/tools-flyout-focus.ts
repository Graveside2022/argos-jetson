// spec-024 PR8 T046 — focus + action helpers for the Tools Flyout.
// Extracted to keep ToolsFlyout.svelte under the 300-LOC + ESLint
// cyclomatic-5 caps.

import { goto } from '$app/navigation';
import { drawerActiveStore, drawerOpenStore } from '$lib/state/ui.svelte';
import type { Mk2Tool } from '$lib/types/mk2-tool';

const FOCUSABLE_SELECTOR =
	'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function getFocusables(root: HTMLElement | null): HTMLElement[] {
	if (!root) return [];
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Returns the element to focus next on a Tab keypress, or null when no
// wrap-around is needed (caller should let the browser advance focus
// normally inside the dialog).
export function pickTabTarget(
	items: readonly HTMLElement[],
	cur: Element | null,
	shift: boolean
): HTMLElement | null {
	const n = items.length;
	if (n === 0) return null;
	const sentinel = shift ? items[0] : items[n - 1];
	if (cur !== sentinel) return null;
	return shift ? items[n - 1] : items[0];
}

export function activateTool(tool: Mk2Tool): void {
	const action = tool.action;
	if (action.kind === 'route') {
		void goto(action.href);
		return;
	}
	if (action.kind === 'drawer') {
		drawerOpenStore.value = true;
		drawerActiveStore.value = action.tab;
		return;
	}
	if (action.kind === 'external') {
		window.open(action.url, '_blank', 'noopener');
	}
	// `unwired` falls through with no side effect.
}
