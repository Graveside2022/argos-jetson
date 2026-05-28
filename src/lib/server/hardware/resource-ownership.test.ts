import { beforeEach, describe, expect, test, vi } from 'vitest';

import { applyOwnership, resolveHackrfOwner } from './resource-ownership';
import type { ResourceState } from './types';
import { HardwareDevice } from './types';

function makeState(overrides: Partial<ResourceState> = {}): ResourceState {
	return {
		device: HardwareDevice.HACKRF,
		isAvailable: true,
		owner: null,
		connectedSince: null,
		isDetected: true,
		...overrides
	};
}

describe('resource-ownership — applyOwnership', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: 1_000_000_000 });
	});

	test('null owner + no current owner: no-op (already free)', () => {
		const s = makeState();
		applyOwnership(s, null);
		expect(s.owner).toBeNull();
		expect(s.isAvailable).toBe(true);
		expect(s.connectedSince).toBeNull();
	});

	test('null owner + non-known current owner: clears state (markFree)', () => {
		const s = makeState({ owner: 'some-container', isAvailable: false, connectedSince: 999 });
		applyOwnership(s, null);
		expect(s.owner).toBeNull();
		expect(s.isAvailable).toBe(true);
		expect(s.connectedSince).toBeNull();
	});

	test('null owner + KNOWN tool owner WITHIN 10s grace: preserves owner (fresh acquire)', () => {
		const s = makeState({
			owner: 'openwebrx',
			isAvailable: false,
			connectedSince: Date.now() - 5000
		});
		applyOwnership(s, null);
		expect(s.owner).toBe('openwebrx');
		expect(s.isAvailable).toBe(false);
	});

	test('null owner + KNOWN tool owner BEYOND 10s grace: markFree', () => {
		const s = makeState({
			owner: 'openwebrx',
			isAvailable: false,
			connectedSince: Date.now() - 11_000
		});
		applyOwnership(s, null);
		expect(s.owner).toBeNull();
		expect(s.isAvailable).toBe(true);
	});

	test('null owner + connectedSince=null + KNOWN owner: markFree (fresh-grace requires timestamp)', () => {
		const s = makeState({ owner: 'openwebrx', isAvailable: false, connectedSince: null });
		applyOwnership(s, null);
		expect(s.owner).toBeNull();
	});

	test('non-null owner + no existing owner: markOwned with new owner', () => {
		const s = makeState();
		applyOwnership(s, 'gsm-evil');
		expect(s.owner).toBe('gsm-evil');
		expect(s.isAvailable).toBe(false);
		expect(s.connectedSince).toBe(Date.now());
	});

	test('non-null owner + existing connectedSince: preserves connectedSince', () => {
		const s = makeState({
			owner: null,
			connectedSince: 12345,
			isAvailable: true
		});
		applyOwnership(s, 'gsm-evil');
		expect(s.connectedSince).toBe(12345);
	});

	test('non-null scanned owner + DIFFERENT KNOWN explicit owner: preserves explicit owner', () => {
		const s = makeState({
			owner: 'openwebrx',
			isAvailable: false,
			connectedSince: 12345
		});
		applyOwnership(s, 'random-container');
		expect(s.owner).toBe('openwebrx');
		expect(s.isAvailable).toBe(false);
		expect(s.connectedSince).toBe(12345);
	});

	test('preserveExplicit sets connectedSince if previously null', () => {
		const s = makeState({
			owner: 'openwebrx',
			isAvailable: true,
			connectedSince: null
		});
		applyOwnership(s, 'random-container');
		expect(s.owner).toBe('openwebrx');
		expect(s.connectedSince).toBe(Date.now());
	});

	test('non-null owner + UNKNOWN explicit owner (not in KNOWN_TOOL_NAMES): markOwned with new scan owner', () => {
		const s = makeState({
			owner: 'docker-random',
			isAvailable: false,
			connectedSince: 12345
		});
		applyOwnership(s, 'new-container');
		expect(s.owner).toBe('new-container');
	});

	test('non-null owner SAME as scanned: no shouldPreserveExplicitOwner trigger, markOwned', () => {
		const s = makeState({
			owner: 'openwebrx',
			isAvailable: false,
			connectedSince: 12345
		});
		applyOwnership(s, 'openwebrx');
		expect(s.owner).toBe('openwebrx');
		expect(s.connectedSince).toBe(12345);
	});
});

describe('resource-ownership — resolveHackrfOwner', () => {
	test('returns canonical process name when processes non-empty', () => {
		expect(resolveHackrfOwner([{ name: 'gsm-evil' }], [])).toBe('gsm-evil');
	});

	test('canonicalizes webrx process names', () => {
		expect(resolveHackrfOwner([{ name: 'openwebrx-hackrf' }], [])).toBe('openwebrx');
	});

	test('returns first process when multiple', () => {
		expect(resolveHackrfOwner([{ name: 'first' }, { name: 'second' }], [])).toBe('first');
	});

	test('falls back to running container when no processes', () => {
		expect(resolveHackrfOwner([], [{ isRunning: true, name: 'novasdr-hackrf' }])).toBe(
			'novasdr'
		);
	});

	test('canonicalizes container name on container fallback', () => {
		expect(resolveHackrfOwner([], [{ isRunning: true, name: 'openwebrx-hackrf' }])).toBe(
			'openwebrx'
		);
	});

	test('skips not-running containers, returns first running', () => {
		expect(
			resolveHackrfOwner(
				[],
				[
					{ isRunning: false, name: 'stopped' },
					{ isRunning: true, name: 'live' }
				]
			)
		).toBe('live');
	});

	test('returns null when no processes and no running container', () => {
		expect(resolveHackrfOwner([], [{ isRunning: false, name: 'stopped' }])).toBeNull();
	});

	test('returns null when both arrays empty', () => {
		expect(resolveHackrfOwner([], [])).toBeNull();
	});

	test('process wins over container even when container is running', () => {
		expect(
			resolveHackrfOwner(
				[{ name: 'gsm-evil' }],
				[{ isRunning: true, name: 'openwebrx-hackrf' }]
			)
		).toBe('gsm-evil');
	});
});

describe('resource-ownership — distinct-kill mutation guards', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: 1_000_000_000 });
	});

	test('grace boundary is strict less-than 10000ms, not ≤', () => {
		// At EXACTLY 10000ms elapsed, owner should NOT be preserved
		const s = makeState({
			owner: 'openwebrx',
			isAvailable: false,
			connectedSince: Date.now() - 10_000
		});
		applyOwnership(s, null);
		expect(s.owner).toBeNull();
	});

	test('shouldPreserveExplicitOwner requires DIFFERENT names — same name falls through to markOwned', () => {
		const s = makeState({
			owner: 'kismet',
			isAvailable: true,
			connectedSince: null
		});
		applyOwnership(s, 'kismet');
		// markOwned set isAvailable=false + connectedSince=now
		expect(s.isAvailable).toBe(false);
		expect(s.connectedSince).toBe(Date.now());
	});

	test('connectedSince=0 is falsy → markOwned sets new timestamp', () => {
		const s = makeState({ owner: null, connectedSince: 0 });
		applyOwnership(s, 'sdrpp');
		expect(s.connectedSince).toBe(Date.now());
	});

	test('resolveHackrfOwner: empty-string container.isRunning=true still matches', () => {
		expect(resolveHackrfOwner([], [{ isRunning: true, name: '' }])).toBe('');
	});
});
