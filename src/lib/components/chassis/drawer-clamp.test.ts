import { describe, expect, it } from 'vitest';

import { clampDrawerHeight, STAGE_RESERVE, TAB_FLOOR } from './drawer-clamp';

describe('clampDrawerHeight (spec-024 PR3 T022)', () => {
	it('returns proposed height untouched when within bounds', () => {
		expect(clampDrawerHeight(280, 1080)).toBe(280);
		expect(clampDrawerHeight(400, 1200)).toBe(400);
	});

	it('clamps to viewport - STAGE_RESERVE on tall drawers', () => {
		// 1080 - 200 = 880 cap
		expect(clampDrawerHeight(1500, 1080)).toBe(880);
		expect(clampDrawerHeight(1080, 1080)).toBe(880);
	});

	it('clamps to TAB_FLOOR when proposal undershoots', () => {
		expect(clampDrawerHeight(50, 1080)).toBe(TAB_FLOOR);
		expect(clampDrawerHeight(0, 1080)).toBe(TAB_FLOOR);
		expect(clampDrawerHeight(-10, 1080)).toBe(TAB_FLOOR);
	});

	it('preserves the TAB_FLOOR floor on tiny viewports', () => {
		// 240 - 200 = 40, but TAB_FLOOR (120) wins
		expect(clampDrawerHeight(280, 240)).toBe(TAB_FLOOR);
		expect(clampDrawerHeight(80, 240)).toBe(TAB_FLOOR);
	});

	it('keeps STAGE_RESERVE clearance on standard laptop viewport', () => {
		// 800 - 200 = 600 max; main stage gets at least 200
		const h = clampDrawerHeight(900, 800);
		expect(h).toBe(600);
		expect(800 - h).toBe(STAGE_RESERVE);
	});

	it('handles 4K resolution', () => {
		expect(clampDrawerHeight(280, 2160)).toBe(280);
		expect(clampDrawerHeight(2200, 2160)).toBe(2160 - STAGE_RESERVE);
	});

	it('TAB_FLOOR and STAGE_RESERVE are 120 / 200 per spec', () => {
		expect(TAB_FLOOR).toBe(120);
		expect(STAGE_RESERVE).toBe(200);
	});
});
