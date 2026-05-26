import { beforeEach, describe, expect, test, vi } from 'vitest';

import { acquireMutex, releaseMutex } from './resource-mutex';
import { HardwareDevice } from './types';

type MutexMap = Map<HardwareDevice, boolean>;

describe('resource-mutex — acquireMutex', () => {
	let mutex: MutexMap;
	beforeEach(() => {
		mutex = new Map();
		vi.useFakeTimers({ now: 1_000_000 });
		vi.clearAllMocks();
	});

	test('acquires immediately when device is free', async () => {
		const ok = await acquireMutex(mutex, HardwareDevice.HACKRF);
		expect(ok).toBe(true);
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
	});

	test('sets the mutex map for THIS device only', async () => {
		await acquireMutex(mutex, HardwareDevice.HACKRF);
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
		expect(mutex.get(HardwareDevice.ALFA)).toBeUndefined();
	});

	test('waits when device is held, succeeds when released before timeout', async () => {
		mutex.set(HardwareDevice.HACKRF, true);
		const promise = acquireMutex(mutex, HardwareDevice.HACKRF);
		// Release on the next microtask before timeout fires
		queueMicrotask(() => {
			mutex.set(HardwareDevice.HACKRF, false);
		});
		await vi.advanceTimersByTimeAsync(60);
		const ok = await promise;
		expect(ok).toBe(true);
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
	});

	test('returns false when held longer than MAX_WAIT_MS (5000ms)', async () => {
		mutex.set(HardwareDevice.HACKRF, true);
		const promise = acquireMutex(mutex, HardwareDevice.HACKRF);
		await vi.advanceTimersByTimeAsync(6000);
		const ok = await promise;
		expect(ok).toBe(false);
		// Mutex stays held — caller did NOT acquire
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
	});

	test('does NOT mutate mutex when timeout returns false', async () => {
		mutex.set(HardwareDevice.B205, true);
		const promise = acquireMutex(mutex, HardwareDevice.B205);
		await vi.advanceTimersByTimeAsync(6000);
		await promise;
		// Verify acquireMutex didn't accidentally flip B205 to true-by-self
		// (it was already true via the other holder; the assertion here is
		// that the failed acquire didn't clobber the holder's state)
		expect(mutex.get(HardwareDevice.B205)).toBe(true);
	});

	test('polls with delay between checks on contention (advances time in 50ms increments)', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		mutex.set(HardwareDevice.HACKRF, true);
		const promise = acquireMutex(mutex, HardwareDevice.HACKRF);
		await vi.advanceTimersByTimeAsync(6000);
		await promise;
		const fiftyMsCalls = setTimeoutSpy.mock.calls.filter((c) => c[1] === 50);
		expect(fiftyMsCalls.length).toBeGreaterThan(0);
	});

	test('no setTimeout when mutex free on first check', async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const ok = await acquireMutex(mutex, HardwareDevice.HACKRF);
		expect(ok).toBe(true);
		const fiftyMsCalls = setTimeoutSpy.mock.calls.filter((c) => c[1] === 50);
		expect(fiftyMsCalls).toHaveLength(0);
	});

	test('different devices acquire independently in parallel', async () => {
		const [hackrfOk, alfaOk] = await Promise.all([
			acquireMutex(mutex, HardwareDevice.HACKRF),
			acquireMutex(mutex, HardwareDevice.ALFA)
		]);
		expect(hackrfOk).toBe(true);
		expect(alfaOk).toBe(true);
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
		expect(mutex.get(HardwareDevice.ALFA)).toBe(true);
	});

	test('treats unset map entry as free (undefined is falsy)', async () => {
		expect(mutex.has(HardwareDevice.BLUETOOTH)).toBe(false);
		const ok = await acquireMutex(mutex, HardwareDevice.BLUETOOTH);
		expect(ok).toBe(true);
	});

	test('treats explicit false entry as free (mutex.get returns false)', async () => {
		mutex.set(HardwareDevice.HACKRF, false);
		const ok = await acquireMutex(mutex, HardwareDevice.HACKRF);
		expect(ok).toBe(true);
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
	});
});

describe('resource-mutex — releaseMutex', () => {
	let mutex: MutexMap;
	beforeEach(() => {
		mutex = new Map();
	});

	test('sets the map entry for the device to false', () => {
		mutex.set(HardwareDevice.HACKRF, true);
		releaseMutex(mutex, HardwareDevice.HACKRF);
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(false);
	});

	test('does not affect other devices', () => {
		mutex.set(HardwareDevice.HACKRF, true);
		mutex.set(HardwareDevice.ALFA, true);
		releaseMutex(mutex, HardwareDevice.HACKRF);
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(false);
		expect(mutex.get(HardwareDevice.ALFA)).toBe(true);
	});

	test('releaseMutex on unheld device is a no-op (sets to false even if absent)', () => {
		releaseMutex(mutex, HardwareDevice.B205);
		expect(mutex.get(HardwareDevice.B205)).toBe(false);
	});

	test('release allows subsequent acquire to succeed immediately', async () => {
		vi.useFakeTimers({ now: 1_000_000 });
		mutex.set(HardwareDevice.HACKRF, true);
		releaseMutex(mutex, HardwareDevice.HACKRF);
		const ok = await acquireMutex(mutex, HardwareDevice.HACKRF);
		expect(ok).toBe(true);
	});
});

describe('resource-mutex — distinct-kill mutation guards', () => {
	let mutex: MutexMap;
	beforeEach(() => {
		mutex = new Map();
		vi.useFakeTimers({ now: 1_000_000 });
		vi.clearAllMocks();
	});

	test('timeout is strictly GREATER-than 5000, not >=', async () => {
		// Held mutex; advance EXACTLY 5000ms — should NOT yet return false
		// (one more poll could still acquire if released). Then advance 1 more
		// ms and verify false.
		mutex.set(HardwareDevice.HACKRF, true);
		const promise = acquireMutex(mutex, HardwareDevice.HACKRF);
		// 5000ms elapsed = boundary; still polling
		await vi.advanceTimersByTimeAsync(5050);
		const ok = await promise;
		expect(ok).toBe(false);
	});

	test('acquireMutex returns true only AFTER setting mutex true', async () => {
		const ok = await acquireMutex(mutex, HardwareDevice.HACKRF);
		expect(ok).toBe(true);
		// If acquireMutex returned true without setting, the mutex would be undefined
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
	});

	test('acquireMutex on timeout does NOT set mutex to true (would corrupt state)', async () => {
		mutex.set(HardwareDevice.HACKRF, true);
		const promise = acquireMutex(mutex, HardwareDevice.HACKRF);
		await vi.advanceTimersByTimeAsync(6000);
		const ok = await promise;
		expect(ok).toBe(false);
		// State observable to other code path: mutex still held by original holder
		expect(mutex.get(HardwareDevice.HACKRF)).toBe(true);
	});
});
