import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __resetTlsMutexForTests, withTlsDisabled } from './tls-mutex';

const ENV_VAR = 'NODE_TLS_REJECT_UNAUTHORIZED';

describe('withTlsDisabled', () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env[ENV_VAR];
		delete process.env[ENV_VAR];
		__resetTlsMutexForTests();
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env[ENV_VAR];
		} else {
			process.env[ENV_VAR] = originalEnv;
		}
		__resetTlsMutexForTests();
	});

	it('sets the env var for the duration of the callback and restores it', async () => {
		expect(process.env[ENV_VAR]).toBeUndefined();

		const observedInside = await withTlsDisabled(async () => {
			return process.env[ENV_VAR];
		});

		expect(observedInside).toBe('0');
		expect(process.env[ENV_VAR]).toBeUndefined();
	});

	it('restores the prior env value even when the callback throws', async () => {
		process.env[ENV_VAR] = '1';

		await expect(
			withTlsDisabled(async () => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');

		expect(process.env[ENV_VAR]).toBe('1');
	});

	it('serializes concurrent callers — two parallel calls do not overlap', async () => {
		// Track entry/exit counts. If the mutex works, at no point should we
		// see `active > 1`.
		let active = 0;
		let maxActive = 0;
		const order: string[] = [];

		type Releaser = () => void;
		const gate = (label: string): { promise: Promise<void>; release: Releaser } => {
			let release!: Releaser;
			const promise = new Promise<void>((resolve) => {
				release = () => {
					order.push(`release:${label}`);
					resolve();
				};
			});
			return { promise, release };
		};

		const gateA = gate('a');
		const gateB = gate('b');

		const runner = (label: string, gateP: Promise<void>) =>
			withTlsDisabled(async () => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				order.push(`enter:${label}:env=${process.env[ENV_VAR] ?? 'UNSET'}`);
				await gateP;
				order.push(`exit:${label}`);
				active -= 1;
			});

		// Kick off both concurrently. `a` should run first (enter + await gateA)
		// while `b` is blocked on the mutex. Releasing gateA lets `a` exit;
		// only then does `b` enter.
		const runA = runner('a', gateA.promise);
		const runB = runner('b', gateB.promise);

		// Yield so `a` has a chance to enter the critical section.
		await Promise.resolve();
		await Promise.resolve();

		expect(active).toBe(1);
		expect(order[0]).toBe('enter:a:env=0');
		// `b` must NOT have entered yet — the mutex is holding it.
		expect(order.some((e) => e.startsWith('enter:b:'))).toBe(false);

		// Release `a`, then `b` can enter.
		gateA.release();
		await runA;

		// Yield so `b` enters.
		await Promise.resolve();
		await Promise.resolve();

		expect(order.some((e) => e.startsWith('enter:b:'))).toBe(true);
		gateB.release();
		await runB;

		expect(maxActive).toBe(1);
		// Env var should be fully restored after both callers finish.
		expect(process.env[ENV_VAR]).toBeUndefined();
	});

	it('does not permanently lock the mutex if a caller throws', async () => {
		await expect(
			withTlsDisabled(async () => {
				throw new Error('first caller fails');
			})
		).rejects.toThrow('first caller fails');

		// A subsequent caller must still be able to acquire the mutex.
		const result = await withTlsDisabled(async () => 'ok');
		expect(result).toBe('ok');
	});
});
