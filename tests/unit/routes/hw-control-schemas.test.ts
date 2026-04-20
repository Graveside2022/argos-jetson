/**
 * Schema validation tests for hardware-control POST routes (Task #8 Wave A).
 *
 * Each route was rewired to use `createHandler(fn, { validateBody: <Schema> })`
 * so malformed bodies are rejected at the factory edge (400) before reaching
 * the handler body. These tests pin the accepted/rejected shapes.
 *
 * Only schema-level checks — full handler integration is covered by the
 * route-level e2e tests (not in scope for this unit suite).
 */
import { describe, expect, it } from 'vitest';

import { _BluedragonControlSchema as BluedragonControlSchema } from '../../../src/routes/api/bluedragon/control/+server';
import { _BluehoodControlSchema as BluehoodControlSchema } from '../../../src/routes/api/bluehood/control/+server';
import { _WebtakVncControlSchema as WebtakVncControlSchema } from '../../../src/routes/api/webtak-vnc/control/+server';
import { _WigleTotakControlSchema as WigleTotakControlSchema } from '../../../src/routes/api/wigletotak/control/+server';

describe('BluedragonControlSchema', () => {
	it('accepts a valid start action with profile + options', () => {
		const parsed = BluedragonControlSchema.safeParse({
			action: 'start',
			profile: 'volume',
			options: { allChannels: true, gpsd: false }
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects an unknown action', () => {
		const parsed = BluedragonControlSchema.safeParse({ action: 'teardown' });
		expect(parsed.success).toBe(false);
	});
});

describe('BluehoodControlSchema', () => {
	it('accepts { action: "status" }', () => {
		const parsed = BluehoodControlSchema.safeParse({ action: 'status' });
		expect(parsed.success).toBe(true);
	});

	it('rejects a missing action field', () => {
		const parsed = BluehoodControlSchema.safeParse({});
		expect(parsed.success).toBe(false);
	});
});

describe('WebtakVncControlSchema', () => {
	it('accepts start + url', () => {
		const parsed = WebtakVncControlSchema.safeParse({
			action: 'start',
			url: 'https://10.3.1.5:8446'
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects start without url (discriminatedUnion constraint)', () => {
		const parsed = WebtakVncControlSchema.safeParse({ action: 'start' });
		expect(parsed.success).toBe(false);
	});
});

describe('WigleTotakControlSchema', () => {
	it('accepts { action: "stop" }', () => {
		const parsed = WigleTotakControlSchema.safeParse({ action: 'stop' });
		expect(parsed.success).toBe(true);
	});

	it('rejects non-string action (e.g. number)', () => {
		const parsed = WigleTotakControlSchema.safeParse({ action: 1 });
		expect(parsed.success).toBe(false);
	});
});
