/**
 * Unit tests for rate-limit-middleware pure helpers.
 *
 * Focus: `isHardwareControlPath()` prefix list. The function gates whether
 * a request hits the 30 req/min hardware tier vs. the 200 req/min generic
 * API tier. Task #4 (P1 audit) added 9 hardware-adjacent tool prefixes
 * that were silently falling to the generic bucket; this test file pins
 * them down so a future refactor can't drop any without a failing test.
 */

import { describe, expect, test } from 'vitest';

import {
	isDragonSyncReadPath,
	isHardwareControlPath
} from '../../src/lib/server/middleware/rate-limit-middleware';

describe('isHardwareControlPath', () => {
	// Paths that MUST be classified as hardware (stricter 30/min tier)
	const hardwarePaths: string[] = [
		// Pre-existing prefixes — regression guard
		'/api/hackrf/status',
		'/api/hackrf/sweep',
		'/api/kismet/control/start',
		'/api/kismet/control/stop',
		'/api/droneid/status',
		'/api/rf/scan',
		'/api/openwebrx/control/start',

		// gsm-evil (broadened from /control-only to whole domain)
		'/api/gsm-evil/control',
		'/api/gsm-evil/status',
		'/api/gsm-evil/activity',
		'/api/gsm-evil/frames',
		'/api/gsm-evil/imsi',
		'/api/gsm-evil/scan',

		// New (Task #4) — hardware-adjacent recon / SDR / capture tools
		'/api/sparrow/status',
		'/api/sightline/status',
		'/api/sdrpp/control',
		'/api/novasdr/start',
		'/api/bluedragon/scan',
		'/api/bluehood/status',
		'/api/dragonsync/control',
		'/api/trunk-recorder/start',
		'/api/hardware/details',
		'/api/hardware/scan'
	];

	test.each(hardwarePaths)('%s → hardware tier', (path) => {
		expect(isHardwareControlPath(path)).toBe(true);
	});

	// Paths that MUST fall through to the generic API tier (200/min)
	const nonHardwarePaths: string[] = [
		'/api/health',
		'/api/map-tiles/osm/1/1/1.png',
		'/api/tak/status',
		'/api/cell-towers/search',
		'/api/captures/list',
		'/api/database/health',
		'/api/system/metrics',
		'/api/weather/current',
		'/api/reports/summary',
		'/api/globalprotect/status',
		'/api/missions/list',
		'/api/agent/run',
		'/api/signals/recent',
		'/api/spiderfoot/scan',
		// Paths outside /api/ should never be classified as hardware
		'/',
		'/dashboard',
		'/gsm-evil' // page route, not API — must NOT match /api/gsm-evil/
	];

	test.each(nonHardwarePaths)('%s → generic API tier', (path) => {
		expect(isHardwareControlPath(path)).toBe(false);
	});

	test('empty path does not match', () => {
		expect(isHardwareControlPath('')).toBe(false);
	});

	test('prefix-only path without trailing segment still matches', () => {
		// startsWith semantics — "/api/hardware/" matches "/api/hardware/x"
		// but NOT "/api/hardware" (no trailing slash). This is intentional:
		// a bare "/api/hardware" route does not exist today; if one is added,
		// it should be explicitly covered by a new prefix or route metadata.
		expect(isHardwareControlPath('/api/hardware')).toBe(false);
		expect(isHardwareControlPath('/api/hardware/')).toBe(true);
	});
});

describe('isDragonSyncReadPath', () => {
	const dragonSyncReadPaths: string[] = [
		'/api/dragonsync/status',
		'/api/dragonsync/devices',
		'/api/dragonsync/fpv',
		'/api/dragonsync/c2',
		'/api/dragonsync/logs'
	];
	test.each(dragonSyncReadPaths)('%s → dragonsync-read tier', (path) => {
		expect(isDragonSyncReadPath(path)).toBe(true);
		expect(isHardwareControlPath(path)).toBe(false);
	});
	test('/api/dragonsync/control stays on hardware', () => {
		expect(isDragonSyncReadPath('/api/dragonsync/control')).toBe(false);
		expect(isHardwareControlPath('/api/dragonsync/control')).toBe(true);
	});
	test('/api/dragonsync/control/<sub> still routes to hardware', () => {
		expect(isDragonSyncReadPath('/api/dragonsync/control/start')).toBe(false);
		expect(isHardwareControlPath('/api/dragonsync/control/start')).toBe(true);
	});
	test('/api/dragonsync/controller is read tier (no prefix collision)', () => {
		expect(isDragonSyncReadPath('/api/dragonsync/controller')).toBe(true);
		expect(isHardwareControlPath('/api/dragonsync/controller')).toBe(false);
	});
	test('/api/dragonsync/controller/status is read tier (no prefix collision)', () => {
		expect(isDragonSyncReadPath('/api/dragonsync/controller/status')).toBe(true);
		expect(isHardwareControlPath('/api/dragonsync/controller/status')).toBe(false);
	});
});
