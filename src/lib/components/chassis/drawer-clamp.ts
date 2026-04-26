// spec-024 PR3 T019 / T022 — Mk II drawer height clamp.
// Extracted from Drawer.svelte so the clamp can be unit-tested independently
// of DOM/window globals. The drawer body must keep at least the 120-px tab
// strip floor and never push the main stage below 200 px.

export const TAB_FLOOR = 120;
export const STAGE_RESERVE = 200;

export function clampDrawerHeight(proposed: number, viewportHeight: number): number {
	const max = Math.max(TAB_FLOOR, viewportHeight - STAGE_RESERVE);
	if (proposed > max) return max;
	if (proposed < TAB_FLOOR) return TAB_FLOOR;
	return proposed;
}
