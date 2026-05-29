import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '$lib/server/env';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';

import {
	getGnssSdrVncStatus,
	startGnssSdrVnc,
	stopGnssSdrVnc
} from './gnss-sdr-vnc-control-service';
import { _resetModuleStateForTest, _setSpawnImplForTest } from './gnss-sdr-vnc-processes';

// Mock the fs-touching helpers in processes.ts so the test does not write to
// /var/lib/argos/gnss-sdr or create the NMEA fifo.
vi.mock('./gnss-sdr-vnc-processes', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./gnss-sdr-vnc-processes')>();
	return {
		...actual,
		writeGeneratedConf: vi.fn(() => '/tmp/argos-gnss-sdr-test.conf'),
		ensureNmeaFifo: vi.fn(),
		removeNmeaFifo: vi.fn()
	};
});

beforeEach(() => {
	// Stub the resolveBin lookups so vnc-common spawn helpers find an executable
	// on the CI runner where Xtigervnc / websockify are not installed.
	env.ARGOS_VNC_XTIGERVNC_BIN = '/bin/sh';
	env.ARGOS_VNC_WEBSOCKIFY_BIN = '/bin/sh';

	// DI seam — every spawn becomes a no-op ChildProcess stub.
	_setSpawnImplForTest(((_cmd: string, _args: readonly string[]) => {
		const proc = {
			pid: Math.floor(Math.random() * 10000) + 1000,
			exitCode: null,
			on: vi.fn(),
			once: vi.fn(),
			kill: vi.fn(),
			unref: vi.fn(),
			stdout: { on: vi.fn() },
			stderr: { on: vi.fn() }
		};
		return proc as never;
	}) as never);

	// Most tests want a successful B205 claim.
	vi.spyOn(resourceManager, 'acquire').mockResolvedValue({
		success: true,
		owner: 'gnss-sdr'
	} as never);
	vi.spyOn(resourceManager, 'release').mockResolvedValue(undefined as never);
});

afterEach(async () => {
	// Drain any module state between tests.
	await stopGnssSdrVnc().catch(() => undefined);
	_resetModuleStateForTest();
	_setSpawnImplForTest(null);
	vi.restoreAllMocks();
	delete env.ARGOS_VNC_XTIGERVNC_BIN;
	delete env.ARGOS_VNC_WEBSOCKIFY_BIN;
});

describe('gnss-sdr-vnc-control-service', () => {
	it('status defaults to inactive when no stack is running', () => {
		const s = getGnssSdrVncStatus();
		expect(s.isRunning).toBe(false);
		expect(s.status).toBe('inactive');
		expect(s.wsPort).toBe(6083);
		expect(s.wsPath).toBe('/websockify');
	});

	it('start claims the B205 via resourceManager', async () => {
		const acquireSpy = resourceManager.acquire as unknown as ReturnType<typeof vi.spyOn>;
		await startGnssSdrVnc();
		expect(acquireSpy).toHaveBeenCalledWith('gnss-sdr', HardwareDevice.B205);
	});

	it('start refuses with friendly error when B205 is locked by another tool', async () => {
		// Mock acquireWithPreempt directly to return a conflict — covers the path
		// where the holder has a registered preempt handler that fails (or the
		// handler runs but the device is still busy on retry). The orphan-fallback
		// path (forceOnOrphan: true) is exercised separately in resource-manager
		// unit tests; this test asserts the friendly-error PROPAGATION up to the
		// public start API when the manager genuinely cannot acquire.
		vi.spyOn(resourceManager, 'acquireWithPreempt').mockResolvedValueOnce({
			success: false,
			owner: 'sdrpp'
		} as never);
		const r = await startGnssSdrVnc();
		expect(r.success).toBe(false);
		expect(r.error).toMatch(/b205-locked-by:sdrpp/);
		expect(r.message).toMatch(/sdrpp/);
	});

	// Note: the "double-start returns idempotent success" path is implemented
	// in startGnssSdrVnc() via `if (isStackAlive()) return successResult(...)`,
	// but cannot be unit-tested because vnc-common/spawn-helpers spawns
	// Xtigervnc + websockify through its own private `spawn` import — our
	// `_setSpawnImplForTest` seam only covers the four service-specific
	// spawns (gnss-sdr, rtknavi_qt, rtkplot_qt, socat). The CI runner has
	// no real Xtigervnc binary, so the shared helpers register a real
	// /bin/sh process that exits immediately, nulling the module-scoped
	// refs and breaking isStackAlive(). Integration test under
	// gnss-sdr-vnc-control-service.integration.test.ts (Phase 4) covers
	// the idempotent path against the real binaries.

	it('stop releases the B205 via resourceManager', async () => {
		await startGnssSdrVnc();
		const releaseSpy = resourceManager.release as unknown as ReturnType<typeof vi.spyOn>;
		await stopGnssSdrVnc();
		expect(releaseSpy).toHaveBeenCalledWith('gnss-sdr', HardwareDevice.B205);
	});

	it('stop without start succeeds silently', async () => {
		const r = await stopGnssSdrVnc();
		expect(r.success).toBe(true);
	});
});
