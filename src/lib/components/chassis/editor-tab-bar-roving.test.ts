import { describe, expect, it } from 'vitest';

import {
	buildItems,
	clampCursor,
	closeItemIdx,
	computeNextCursor,
	type RovingItem,
	tabItemIdx
} from './editor-tab-bar-roving';

describe('buildItems (spec-026 Phase 8.6 EditorTabBar)', () => {
	it('emits only tabs when withClose=false', () => {
		const items: RovingItem[] = buildItems(3, false);
		expect(items).toEqual([
			{ kind: 'tab', tabIdx: 0 },
			{ kind: 'tab', tabIdx: 1 },
			{ kind: 'tab', tabIdx: 2 }
		]);
	});

	it('interleaves tab + close pairs when withClose=true', () => {
		const items = buildItems(2, true);
		expect(items).toEqual([
			{ kind: 'tab', tabIdx: 0 },
			{ kind: 'close', tabIdx: 0 },
			{ kind: 'tab', tabIdx: 1 },
			{ kind: 'close', tabIdx: 1 }
		]);
	});

	it('returns an empty list for count=0', () => {
		expect(buildItems(0, true)).toEqual([]);
		expect(buildItems(0, false)).toEqual([]);
	});

	it('preserves DOM order: tab N immediately precedes close N', () => {
		const items = buildItems(4, true);
		expect(items.length).toBe(8);
		for (let i = 0; i < 4; i++) {
			expect(items[i * 2]).toEqual({ kind: 'tab', tabIdx: i });
			expect(items[i * 2 + 1]).toEqual({ kind: 'close', tabIdx: i });
		}
	});
});

describe('tabItemIdx / closeItemIdx (flat-index mapping)', () => {
	it('maps tab index identity-style without close', () => {
		expect(tabItemIdx(0, false)).toBe(0);
		expect(tabItemIdx(3, false)).toBe(3);
	});

	it('doubles tab index when close is present', () => {
		expect(tabItemIdx(0, true)).toBe(0);
		expect(tabItemIdx(1, true)).toBe(2);
		expect(tabItemIdx(4, true)).toBe(8);
	});

	it('returns -1 sentinel for closeItemIdx without close', () => {
		expect(closeItemIdx(0, false)).toBe(-1);
		expect(closeItemIdx(5, false)).toBe(-1);
	});

	it('returns the slot following the tab when close is present', () => {
		expect(closeItemIdx(0, true)).toBe(1);
		expect(closeItemIdx(1, true)).toBe(3);
		expect(closeItemIdx(4, true)).toBe(9);
	});
});

describe('computeNextCursor (APG Toolbar arrow-key dispatch)', () => {
	it('handles ArrowRight with wraparound', () => {
		expect(computeNextCursor(0, 4, 'ArrowRight')).toEqual({ next: 1, handled: true });
		expect(computeNextCursor(3, 4, 'ArrowRight')).toEqual({ next: 0, handled: true });
	});

	it('handles ArrowLeft with wraparound', () => {
		expect(computeNextCursor(2, 4, 'ArrowLeft')).toEqual({ next: 1, handled: true });
		expect(computeNextCursor(0, 4, 'ArrowLeft')).toEqual({ next: 3, handled: true });
	});

	it('jumps to first/last on Home/End', () => {
		expect(computeNextCursor(2, 5, 'Home')).toEqual({ next: 0, handled: true });
		expect(computeNextCursor(0, 5, 'End')).toEqual({ next: 4, handled: true });
	});

	it('ignores non-roving keys', () => {
		for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a', 'ArrowUp', 'ArrowDown']) {
			expect(computeNextCursor(1, 4, key)).toEqual({ next: 1, handled: false });
		}
	});

	it('is a no-op when the item list is empty', () => {
		expect(computeNextCursor(0, 0, 'ArrowRight')).toEqual({ next: 0, handled: false });
	});

	it('roving order traverses tab→close→tab for a 2-tab toolbar', () => {
		// items: [tab0, close0, tab1, close1] — len=4
		let cursor = 0; // tab0
		cursor = computeNextCursor(cursor, 4, 'ArrowRight').next; // close0
		expect(cursor).toBe(1);
		cursor = computeNextCursor(cursor, 4, 'ArrowRight').next; // tab1
		expect(cursor).toBe(2);
		cursor = computeNextCursor(cursor, 4, 'ArrowRight').next; // close1
		expect(cursor).toBe(3);
		cursor = computeNextCursor(cursor, 4, 'ArrowRight').next; // wrap to tab0
		expect(cursor).toBe(0);
	});
});

describe('clampCursor (post-render clamp after tab removal)', () => {
	it('returns the cursor untouched when within bounds', () => {
		expect(clampCursor(0, 4)).toBe(0);
		expect(clampCursor(2, 4)).toBe(2);
		expect(clampCursor(3, 4)).toBe(3);
	});

	it('clamps to last valid index after items shrink', () => {
		expect(clampCursor(5, 4)).toBe(3);
		expect(clampCursor(99, 1)).toBe(0);
	});

	it('returns 0 when items are empty', () => {
		expect(clampCursor(0, 0)).toBe(0);
		expect(clampCursor(5, 0)).toBe(0);
	});

	it('floors negative cursors at 0', () => {
		expect(clampCursor(-1, 4)).toBe(0);
		expect(clampCursor(-99, 4)).toBe(0);
	});
});

describe('roving guarantees (composite ARIA contract)', () => {
	it('every close item has an immediately preceding tab item with the same tabIdx', () => {
		const items = buildItems(5, true);
		for (let i = 0; i < items.length; i++) {
			if (items[i].kind === 'close') {
				expect(items[i - 1].kind).toBe('tab');
				expect(items[i - 1].tabIdx).toBe(items[i].tabIdx);
			}
		}
	});

	it('len = tabs.length when no close, 2× when close present', () => {
		expect(buildItems(7, false).length).toBe(7);
		expect(buildItems(7, true).length).toBe(14);
	});
});
