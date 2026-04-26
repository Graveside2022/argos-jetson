/**
 * ResourceManager self-reacquire regression tests.
 *
 * Covers the fix for the 409 conflict that used to fire when the same tool
 * tried to re-acquire a device it already owned (e.g. double POST to
 * /api/novasdr/control {action: 'start'}).
 *
 * QUARANTINED 2026-04-21 — these tests exercise the public `resourceManager`
 * singleton, which runs a live `scanForOrphans` at module load and a 30s
 * `refreshHackrf` poll against real `docker ps` output. When the poll fires
 * during a test (13s+ killDeviceHolders in forceRelease also stalls),
 * ownership state is overwritten and assertions become non-deterministic.
 * Depending on whether a HackRF container is actually running on the host,
 * the first `acquire('novasdr', ...)` call can return success or failure.
 *
 * Fixing properly requires either:
 *   1. Making ResourceManager a non-singleton (factory) so tests can construct
 *      a fresh instance per test with the refresh loop disabled.
 *   2. Mocking the docker-scan layer (resource-refresh + resource-scan) so
 *      the test instance sees only the state tests explicitly set.
 *
 * Either option is scope outside trunk-health hygiene (Track A). Tracked as
 * a separate refactor ticket; see plan track-a-repo-health-then-b-vuln-
 * remediation.md § A1.1. 30-day tombstone — if this skip survives to 2026-
 * 05-21 without conversion, delete these tests instead of keeping dead code.
 */

import { describe, expect, it } from 'vitest';

import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';

const HACKRF = HardwareDevice.HACKRF;

describe.skip('ResourceManager self-reacquire (QUARANTINED — see file header)', () => {
	it('second acquire by same tool returns success', async () => {
		const first = await resourceManager.acquire('novasdr', HACKRF);
		expect(first.success).toBe(true);

		const second = await resourceManager.acquire('novasdr', HACKRF);
		expect(second.success).toBe(true);
		expect(second.owner).toBe('novasdr');
	});

	it('different tool still gets conflict when resource is held', async () => {
		const first = await resourceManager.acquire('novasdr', HACKRF);
		expect(first.success).toBe(true);

		const second = await resourceManager.acquire('openwebrx', HACKRF);
		expect(second.success).toBe(false);
		expect(second.owner).toBe('novasdr');
	});

	it('release then reacquire works normally', async () => {
		const first = await resourceManager.acquire('novasdr', HACKRF);
		expect(first.success).toBe(true);

		const released = await resourceManager.release('novasdr', HACKRF);
		expect(released.success).toBe(true);

		const third = await resourceManager.acquire('novasdr', HACKRF);
		expect(third.success).toBe(true);
	});

	it('three consecutive self-reacquires all succeed', async () => {
		const r1 = await resourceManager.acquire('novasdr', HACKRF);
		const r2 = await resourceManager.acquire('novasdr', HACKRF);
		const r3 = await resourceManager.acquire('novasdr', HACKRF);
		expect(r1.success).toBe(true);
		expect(r2.success).toBe(true);
		expect(r3.success).toBe(true);
	});
});
