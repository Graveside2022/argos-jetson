import { describe, expect, it } from 'vitest';

import { withWebRxLock } from './webrx-control-lock';

/** Delay helper that doesn't depend on timers. */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('withWebRxLock', () => {
	it('returns the value resolved by the wrapped function', async () => {
		const result = await withWebRxLock(async () => 'done');
		expect(result).toBe('done');
	});

	it('returns synchronous values from async wrappers', async () => {
		const result = await withWebRxLock(async () => 42);
		expect(result).toBe(42);
	});

	it('propagates rejection from the wrapped function', async () => {
		await expect(withWebRxLock(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
			'boom'
		);
	});

	it('serializes concurrent calls — second waits for first to settle', async () => {
		const order: string[] = [];
		const a = withWebRxLock(async () => {
			order.push('a-start');
			await delay(20);
			order.push('a-end');
			return 'a';
		});
		const b = withWebRxLock(async () => {
			order.push('b-start');
			await delay(5);
			order.push('b-end');
			return 'b';
		});
		const [resA, resB] = await Promise.all([a, b]);
		expect(resA).toBe('a');
		expect(resB).toBe('b');
		expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
	});

	it('still runs subsequent operations after a rejection', async () => {
		const failure = withWebRxLock(async () => {
			throw new Error('first failed');
		});
		await expect(failure).rejects.toThrow('first failed');

		const success = await withWebRxLock(async () => 'recovered');
		expect(success).toBe('recovered');
	});

	it('serializes three concurrent calls in order', async () => {
		const order: number[] = [];
		const tasks = [1, 2, 3].map((n) =>
			withWebRxLock(async () => {
				order.push(n);
				await delay(5);
				return n;
			})
		);
		const results = await Promise.all(tasks);
		expect(results).toEqual([1, 2, 3]);
		expect(order).toEqual([1, 2, 3]);
	});

	it('releases the lock even when fn throws synchronously', async () => {
		await expect(
			withWebRxLock(async () => {
				throw new Error('sync throw inside async');
			})
		).rejects.toThrow('sync throw inside async');

		// Lock must be free for the next caller.
		const after = await withWebRxLock(async () => 'after');
		expect(after).toBe('after');
	});
});
