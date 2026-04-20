/**
 * Schema validation tests for Task #8 Wave D — rf/* (HackRF sweep) routes.
 *
 * All three routes already had handler-local Zod parse; Wave D wires them
 * via the `createHandler` factory `validateBody:` option so malformed bodies
 * are rejected at the edge before the handler body runs.
 *
 * Schema source: `src/lib/schemas/rf.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
	EmergencyStopRequestSchema,
	StartSweepRequestSchema,
	StopSweepRequestSchema
} from '../../../src/lib/schemas/rf';

describe('StartSweepRequestSchema (rf/start-sweep POST)', () => {
	it('accepts a minimal start-sweep request with one range + cycleTime', () => {
		const parsed = StartSweepRequestSchema.safeParse({
			frequencies: [{ start: 2400, stop: 2500 }],
			cycleTime: 10
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects missing frequencies array', () => {
		const parsed = StartSweepRequestSchema.safeParse({ cycleTime: 10 });
		expect(parsed.success).toBe(false);
	});
});

describe('StopSweepRequestSchema (rf/stop-sweep POST)', () => {
	it('accepts an empty stop request (all fields optional)', () => {
		const parsed = StopSweepRequestSchema.safeParse({});
		expect(parsed.success).toBe(true);
	});
	it('rejects non-string deviceType', () => {
		const parsed = StopSweepRequestSchema.safeParse({ deviceType: 42 });
		expect(parsed.success).toBe(false);
	});
});

describe('EmergencyStopRequestSchema (rf/emergency-stop POST)', () => {
	it('accepts an empty emergency-stop body', () => {
		const parsed = EmergencyStopRequestSchema.safeParse({});
		expect(parsed.success).toBe(true);
	});
	it('rejects non-object body (string)', () => {
		const parsed = EmergencyStopRequestSchema.safeParse('stop');
		expect(parsed.success).toBe(false);
	});
});
