// spec-024 PR8 T046 — focus + action helpers for the Tools Flyout.
// Extracted to keep ToolsFlyout.svelte under the 300-LOC + ESLint
// cyclomatic-5 caps.

import { goto } from '$app/navigation';
import { drawerActiveStore, drawerOpenStore } from '$lib/state/ui.svelte';
import { pinnedToolsStore } from '$lib/stores/dashboard/pinned-tools-store.svelte';
import type { Mk2Tool, Mk2ToolPillar } from '$lib/types/mk2-tool';

// Routes already represented by the FIXED rail slots — pinning these would
// duplicate them on the rail. Mirrors the FIXED list in LeftRail.svelte.
const FIXED_ROUTE_IDS = new Set(['agents', 'overview', 'map']);

function isFixedRouteTool(action: Mk2Tool['action']): boolean {
	if (action.kind !== 'route') return false;
	const last = action.href.split('/').filter(Boolean).pop() ?? '';
	return FIXED_ROUTE_IDS.has(last);
}

function shouldPinOnActivate(tool: Mk2Tool): boolean {
	const kind = tool.action.kind;
	if (kind === 'drawer' || kind === 'unwired') return false;
	return !isFixedRouteTool(tool.action);
}

const FOCUSABLE_SELECTOR =
	'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function getFocusables(root: HTMLElement | null): HTMLElement[] {
	if (!root) return [];
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Returns the element to focus next on a Tab keypress, or null when no
// wrap-around is needed (caller should let the browser advance focus
// normally inside the dialog).
// fallow-ignore-next-line complexity
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
	// Auto-pin to LeftRail so the tool gets its own numbered slot. Drawer-
	// only and unwired tools (and tools that route to a fixed rail slot)
	// are filtered out by `shouldPinOnActivate`.
	if (shouldPinOnActivate(tool)) {
		pinnedToolsStore.pin(tool.id);
	}
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
		void goto(`/dashboard/mk2/embed/${encodeURIComponent(tool.id)}`);
		return;
	}
	// `unwired` falls through with no side effect.
}

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function isArrowKey(k: string): k is ArrowKey {
	return ARROW_KEYS.includes(k);
}

export function actionLabel(t: Mk2Tool): string {
	if (t.action.kind === 'route') return 'OPEN VIEW';
	if (t.action.kind === 'drawer') return 'OPEN DRAWER';
	if (t.action.kind === 'external') return 'OPEN VIEW';
	return 'PENDING';
}

export interface ArrowResult {
	toolId?: string;
	pillar?: Mk2ToolPillar;
}

// ↑↓ moves selection within the active pillar's tool list (no wrap).
// fallow-ignore-next-line complexity
function pickVertical(
	pillarTools: readonly { id: string }[],
	currentToolId: string | null,
	goDown: boolean
): ArrowResult {
	if (pillarTools.length === 0) return {};
	const idx = currentToolId ? pillarTools.findIndex((t) => t.id === currentToolId) : -1;
	if (idx < 0) return { toolId: pillarTools[0].id };
	const next = goDown ? Math.min(idx + 1, pillarTools.length - 1) : Math.max(idx - 1, 0);
	return { toolId: pillarTools[next].id };
}

// ←→ cycles pillars (wraps); caller resets selection to first tool of new pillar.
function pickHorizontal(
	pillars: readonly Mk2ToolPillar[],
	currentPillar: Mk2ToolPillar,
	goRight: boolean
): ArrowResult {
	const pIdx = pillars.indexOf(currentPillar);
	if (pIdx < 0) return {};
	const dir = goRight ? 1 : -1;
	return { pillar: pillars[(pIdx + dir + pillars.length) % pillars.length] };
}

export function pickArrowTarget(
	pillarTools: readonly { id: string }[],
	pillars: readonly Mk2ToolPillar[],
	currentToolId: string | null,
	currentPillar: Mk2ToolPillar,
	key: ArrowKey
): ArrowResult {
	if (key === 'ArrowUp') return pickVertical(pillarTools, currentToolId, false);
	if (key === 'ArrowDown') return pickVertical(pillarTools, currentToolId, true);
	if (key === 'ArrowLeft') return pickHorizontal(pillars, currentPillar, false);
	return pickHorizontal(pillars, currentPillar, true);
}
