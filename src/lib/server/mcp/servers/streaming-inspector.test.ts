// Unit tests for the two new helper functions added in spec-024 PR 9c (T053):
// parseFrameOrRecord + recordIfShapeInvalid. The StreamingInspector class
// itself starts a server at module load (private), so testing the pure
// helpers is the right granularity — the rest of the new code (3 tool
// declarations) is schema + thin apiFetch/EventSource wrappers.
//
// Mock env BEFORE importing — module load triggers env.ARGOS_API_URL +
// ARGOS_API_KEY validation in $lib/server/env.

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/env', () => ({
	env: {
		ARGOS_API_URL: 'http://localhost:5173',
		ARGOS_API_KEY: 'x'.repeat(32)
	}
}));

vi.mock('../shared/api-client', () => ({
	apiFetch: vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) })
}));

// Block the module-level server.start() side effect.
vi.mock('../shared/base-server', async () => {
	const actual =
		await vi.importActual<typeof import('../shared/base-server')>('../shared/base-server');
	return {
		...actual,
		BaseMCPServer: class FakeBase {
			constructor(_name: string) {}
			start() {
				return Promise.resolve();
			}
		}
	};
});

const { parseFrameOrRecord, recordIfShapeInvalid } = await import('./streaming-inspector');

describe('parseFrameOrRecord', () => {
	it('returns the parsed object on valid JSON and does not record an error', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		const parsed = parseFrameOrRecord('{"ok":true}', errors, 100);
		expect(parsed).toEqual({ ok: true });
		expect(errors).toEqual([]);
	});

	it('returns null + records a parse error on malformed JSON', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		const parsed = parseFrameOrRecord('{not-json', errors, 200);
		expect(parsed).toBeNull();
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toMatch(/^frame parse error:/);
		expect(errors[0]?.timestamp).toBe(200);
	});

	it('records the parse-error timestamp passed in (not Date.now)', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		parseFrameOrRecord('garbage', errors, 12345);
		expect(errors[0]?.timestamp).toBe(12345);
	});
});

describe('recordIfShapeInvalid', () => {
	const validFrame = {
		startFreq: 88_000_000,
		endFreq: 108_000_000,
		power: [-50, -55, -60],
		timestamp: 1700000000000
	};

	it('does not record an error when all 4 fields are well-typed', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		recordIfShapeInvalid(validFrame, errors, 0);
		expect(errors).toEqual([]);
	});

	it('records when startFreq is missing', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		recordIfShapeInvalid({ ...validFrame, startFreq: undefined }, errors, 0);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toMatch(/missing required fields/);
	});

	it('records when power is not an array', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		recordIfShapeInvalid({ ...validFrame, power: 'not-an-array' }, errors, 0);
		expect(errors).toHaveLength(1);
	});

	it('records when timestamp is a string', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		recordIfShapeInvalid({ ...validFrame, timestamp: 'now' }, errors, 0);
		expect(errors).toHaveLength(1);
	});

	it('records when endFreq is missing', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		recordIfShapeInvalid({ ...validFrame, endFreq: undefined }, errors, 0);
		expect(errors).toHaveLength(1);
	});

	it('preserves the timestamp argument in the recorded error', () => {
		const errors: Array<{ message: string; timestamp: number }> = [];
		recordIfShapeInvalid({}, errors, 9999);
		expect(errors[0]?.timestamp).toBe(9999);
	});
});
