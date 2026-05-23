import { describe, expect, it } from 'vitest';

import { gpOutput, gpStatus } from './globalprotect-store.svelte';

describe('globalprotect-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('gpStatus defaults to disconnected and is settable', () => {
		gpStatus.set({ status: 'disconnected' });
		expect(gpStatus.current.status).toBe('disconnected');
		gpStatus.set({ status: 'connected', assignedIp: '10.0.0.1' });
		expect(gpStatus.current.status).toBe('connected');
		expect(gpStatus.current.assignedIp).toBe('10.0.0.1');
	});

	it('gpOutput holds a replaceable string array', () => {
		gpOutput.set([]);
		expect(gpOutput.current).toHaveLength(0);
		gpOutput.set(['line1', 'line2']);
		expect(gpOutput.current).toEqual(['line1', 'line2']);
	});
});
