/**
 * Unit tests for rate-limit-middleware classification helpers.
 *
 * Sprawl-cleanup pass (Phase 3): the original suite enumerated ~37 hardware
 * paths × ~14 non-hardware paths via `test.each`. Each `prefix` in
 * `HARDWARE_PATH_PREFIXES` has the same `startsWith` semantics, so every
 * additional sample row killed the same L122 mutant. Collapsed to one row
 * per prefix family + boundary cases per docs/mutation-baseline-2026-05-26-phase3.md.
 *
 * The orchestrator (`checkRateLimit`) + helpers (`getSafeClientAddress`,
 * `checkWsConnectionRateLimit`) live in `rate-limit-middleware-internals.test.ts`.
 */

import { describe, expect, test } from 'vitest';

import {
	isDragonSyncReadPath,
	isHardwareControlPath
} from '../../src/lib/server/middleware/rate-limit-middleware';

describe('isHardwareControlPath', () => {
	// One representative path per prefix family — each prefix has identical
	// `startsWith` semantics, so one sample is enough to kill the relevant mutants.
	const hardwareFamilies: string[] = [
		'/api/hackrf/status',
		'/api/kismet/control/start',
		'/api/droneid/status',
		'/api/rf/scan',
		'/api/openwebrx/control/start',
		'/api/gsm-evil/status',
		'/api/sparrow/status',
		'/api/sightline/status',
		'/api/sdrpp/control',
		'/api/novasdr/start',
		'/api/bluedragon/scan',
		'/api/bluehood/status',
		'/api/dragonsync/control',
		'/api/trunk-recorder/start',
		'/api/hardware/details',
		'/api/database/query'
	];

	test.each(hardwareFamilies)('%s → hardware tier', (path) => {
		expect(isHardwareControlPath(path)).toBe(true);
	});

	// Representative non-hardware paths — one /api/ sample plus two non-/api/ to
	// kill the prefix-check and `startsWith('/api/')` mutants.
	test.each([
		'/api/health',
		'/dashboard',
		'/gsm-evil' // page route, not API — must NOT match /api/gsm-evil/
	])('%s → generic API tier', (path) => {
		expect(isHardwareControlPath(path)).toBe(false);
	});

	test('empty path does not match', () => {
		expect(isHardwareControlPath('')).toBe(false);
	});

	test('prefix without trailing slash does not match (startsWith semantics)', () => {
		expect(isHardwareControlPath('/api/hardware')).toBe(false);
		expect(isHardwareControlPath('/api/hardware/')).toBe(true);
	});
});

describe('isDragonSyncReadPath', () => {
	test('/api/dragonsync/<sub> → read tier (when not /control)', () => {
		expect(isDragonSyncReadPath('/api/dragonsync/status')).toBe(true);
		expect(isHardwareControlPath('/api/dragonsync/status')).toBe(false);
	});

	test('/api/dragonsync/control → hardware (not read)', () => {
		expect(isDragonSyncReadPath('/api/dragonsync/control')).toBe(false);
		expect(isHardwareControlPath('/api/dragonsync/control')).toBe(true);
	});

	test('/api/dragonsync/control/<sub> → hardware (subpath still control)', () => {
		expect(isDragonSyncReadPath('/api/dragonsync/control/start')).toBe(false);
		expect(isHardwareControlPath('/api/dragonsync/control/start')).toBe(true);
	});

	test('/api/dragonsync/controller* → read tier (prefix-collision guard)', () => {
		// Critical: `/api/dragonsync/controller` must NOT match `/api/dragonsync/control`
		// even though `control` is a substring. Tests the exact + subpath check
		// in isDragonSyncControlPath.
		expect(isDragonSyncReadPath('/api/dragonsync/controller')).toBe(true);
		expect(isHardwareControlPath('/api/dragonsync/controller')).toBe(false);
		expect(isDragonSyncReadPath('/api/dragonsync/controller/status')).toBe(true);
		expect(isHardwareControlPath('/api/dragonsync/controller/status')).toBe(false);
	});
});
