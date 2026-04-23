/**
 * Schema validation tests for Task #8 Wave B routes.
 *
 * Wave B wired `createHandler(fn, { validateBody: <Schema> })` on 9 POST
 * endpoints that already had handler-local Zod. The factory now rejects
 * malformed bodies at the edge (400) before the handler body runs.
 *
 * Only schema-level parse checks — full handler integration is covered
 * by the route-level e2e tests (not in scope for this unit suite).
 */
import { describe, expect, it } from 'vitest';

import { DragonSyncControlSchema } from '../../../src/lib/schemas/dragonsync';
import {
	CoverageRequestSchema,
	P2PRequestSchema,
	RouteRequestSchema
} from '../../../src/lib/schemas/rf-propagation';
import { _KismetControlSchema as KismetControlSchema } from '../../../src/routes/api/kismet/control/+server';
import { _SightlineControlSchema as SightlineControlSchema } from '../../../src/routes/api/sightline/control/+server';
import { _SparrowBluetoothControlSchema as SparrowBluetoothControlSchema } from '../../../src/routes/api/sparrow/bluetooth/+server';
import { _SparrowControlSchema as SparrowControlSchema } from '../../../src/routes/api/sparrow/control/+server';
import { _SpiderfootControlSchema as SpiderfootControlSchema } from '../../../src/routes/api/spiderfoot/control/+server';

describe('SightlineControlSchema', () => {
	it('accepts { action: "status" }', () => {
		expect(SightlineControlSchema.safeParse({ action: 'status' }).success).toBe(true);
	});
	it('rejects unknown action', () => {
		expect(SightlineControlSchema.safeParse({ action: 'pause' }).success).toBe(false);
	});
});

describe('SpiderfootControlSchema', () => {
	it('accepts { action: "start" }', () => {
		expect(SpiderfootControlSchema.safeParse({ action: 'start' }).success).toBe(true);
	});
	it('rejects missing action', () => {
		expect(SpiderfootControlSchema.safeParse({}).success).toBe(false);
	});
});

describe('SparrowBluetoothControlSchema', () => {
	it('accepts { action: "stop" }', () => {
		expect(SparrowBluetoothControlSchema.safeParse({ action: 'stop' }).success).toBe(true);
	});
	it('rejects action: "status" (not allowed on this endpoint)', () => {
		expect(SparrowBluetoothControlSchema.safeParse({ action: 'status' }).success).toBe(false);
	});
});

describe('SparrowControlSchema', () => {
	it('accepts { action: "start" }', () => {
		expect(SparrowControlSchema.safeParse({ action: 'start' }).success).toBe(true);
	});
	it('rejects non-string action', () => {
		expect(SparrowControlSchema.safeParse({ action: 0 }).success).toBe(false);
	});
});

describe('DragonSyncControlSchema', () => {
	it('accepts { action: "start" }', () => {
		expect(DragonSyncControlSchema.safeParse({ action: 'start' }).success).toBe(true);
	});
	it('rejects action: "status" (not allowed — only start/stop)', () => {
		expect(DragonSyncControlSchema.safeParse({ action: 'status' }).success).toBe(false);
	});
});

describe('KismetControlSchema', () => {
	it('accepts { action: "status" }', () => {
		expect(KismetControlSchema.safeParse({ action: 'status' }).success).toBe(true);
	});
	it('rejects empty body', () => {
		expect(KismetControlSchema.safeParse({}).success).toBe(false);
	});
});

describe('CoverageRequestSchema (rf-propagation/compute)', () => {
	it('accepts minimal valid coverage request', () => {
		const parsed = CoverageRequestSchema.safeParse({
			lat: 36.05,
			lon: -115.17,
			frequency: 2400,
			polarization: 1,
			txHeight: 2,
			rxHeight: 1.5,
			radius: 5
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects lat out of range', () => {
		const parsed = CoverageRequestSchema.safeParse({
			lat: 999,
			lon: 0,
			frequency: 2400,
			polarization: 1,
			txHeight: 2,
			rxHeight: 1.5,
			radius: 5
		});
		expect(parsed.success).toBe(false);
	});
});

describe('P2PRequestSchema (rf-propagation/p2p)', () => {
	it('accepts a valid tx/rx pair', () => {
		const parsed = P2PRequestSchema.safeParse({
			txLat: 36.05,
			txLon: -115.17,
			rxLat: 36.06,
			rxLon: -115.18,
			frequency: 433,
			polarization: 0,
			txHeight: 10,
			rxHeight: 2
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects missing rxLon', () => {
		const parsed = P2PRequestSchema.safeParse({
			txLat: 36.05,
			txLon: -115.17,
			rxLat: 36.06,
			frequency: 433,
			polarization: 0,
			txHeight: 10,
			rxHeight: 2
		});
		expect(parsed.success).toBe(false);
	});
});

describe('RouteRequestSchema (rf-propagation/route)', () => {
	it('accepts a request with one waypoint', () => {
		const parsed = RouteRequestSchema.safeParse({
			txLat: 36.05,
			txLon: -115.17,
			frequency: 433,
			polarization: 0,
			txHeight: 10,
			rxHeight: 2,
			waypoints: [[36.06, -115.18]]
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects empty waypoints array', () => {
		const parsed = RouteRequestSchema.safeParse({
			txLat: 36.05,
			txLon: -115.17,
			frequency: 433,
			polarization: 0,
			txHeight: 10,
			rxHeight: 2,
			waypoints: []
		});
		expect(parsed.success).toBe(false);
	});
});
