import { beforeEach, describe, expect, it, vi } from 'vitest';

const scanAllHardwareMock = vi.fn();
const monitorStartMock = vi.fn();
const takInitMock = vi.fn();
const gpInitMock = vi.fn();

vi.mock('$lib/server/hardware/detection/hardware-detector', () => ({
	scanAllHardware: scanAllHardwareMock,
	globalHardwareMonitor: { start: monitorStartMock }
}));

vi.mock('$lib/server/tak/tak-service', () => ({
	TakService: { getInstance: () => ({ initialize: takInitMock }) }
}));

vi.mock('$lib/server/services/globalprotect/globalprotect-service', () => ({
	GlobalProtectService: { getInstance: () => ({ initialize: gpInitMock }) }
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

describe('initServerProcesses', () => {
	beforeEach(() => {
		scanAllHardwareMock.mockReset();
		monitorStartMock.mockReset();
		takInitMock.mockReset();
		gpInitMock.mockReset();
		scanAllHardwareMock.mockResolvedValue({
			stats: { total: 0, connected: 0, byCategory: {} }
		});
		takInitMock.mockResolvedValue(undefined);
		gpInitMock.mockResolvedValue(undefined);
	});

	it('skips every initializer when building=true', async () => {
		const { initServerProcesses } = await import('./bootstrap');
		initServerProcesses(true);
		expect(scanAllHardwareMock).not.toHaveBeenCalled();
		expect(takInitMock).not.toHaveBeenCalled();
		expect(gpInitMock).not.toHaveBeenCalled();
		expect(monitorStartMock).not.toHaveBeenCalled();
	});

	it('runs every initializer when building=false', async () => {
		const { initServerProcesses } = await import('./bootstrap');
		initServerProcesses(false);
		await new Promise((resolve) => setImmediate(resolve));
		expect(scanAllHardwareMock).toHaveBeenCalledOnce();
		expect(takInitMock).toHaveBeenCalledOnce();
		expect(gpInitMock).toHaveBeenCalledOnce();
		expect(monitorStartMock).toHaveBeenCalledWith(30_000);
	});
});
