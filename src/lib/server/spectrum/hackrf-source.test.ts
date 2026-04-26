import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HardwareDevice } from '$lib/server/hardware/types';

// Mock sweepManager BEFORE importing HackRFSpectrumSource — the source
// captures the singleton at import time.
const mockSweepManager = Object.assign(new EventEmitter(), {
	startCycle: vi.fn().mockResolvedValue(true),
	stopSweep: vi.fn().mockResolvedValue(undefined)
});

vi.mock('$lib/server/hackrf/sweep-manager', () => ({
	sweepManager: mockSweepManager
}));

const { HackRFSpectrumSource } = await import('./hackrf-source');

import type { SpectrumConfig, SpectrumFrame } from './types';

const baseConfig: SpectrumConfig = {
	startFreq: 88_000_000,
	endFreq: 108_000_000,
	binWidth: 100_000,
	gain: { kind: 'hackrf', amp: 0, lna: 16, vga: 20 }
};

describe('HackRFSpectrumSource', () => {
	beforeEach(() => {
		mockSweepManager.startCycle.mockClear();
		mockSweepManager.stopSweep.mockClear();
		mockSweepManager.removeAllListeners();
	});

	afterEach(() => {
		mockSweepManager.removeAllListeners();
	});

	it('exposes HACKRF as device', () => {
		const src = new HackRFSpectrumSource();
		expect(src.device).toBe(HardwareDevice.HACKRF);
	});

	it('start() forwards center MHz + cycleTimeMs to sweepManager.startCycle', async () => {
		const src = new HackRFSpectrumSource();
		await src.start(baseConfig);

		expect(mockSweepManager.startCycle).toHaveBeenCalledTimes(1);
		const [freqs, cycleMs] = mockSweepManager.startCycle.mock.calls[0];
		expect(freqs).toEqual([{ value: 98, unit: 'MHz' }]); // (88+108)/2 = 98 MHz
		expect(cycleMs).toBe(10_000);
	});

	it("translates 'spectrum_data' event into 'frame' SpectrumFrame", async () => {
		const src = new HackRFSpectrumSource();
		await src.start(baseConfig);

		const received: SpectrumFrame[] = [];
		src.on('frame', (f) => received.push(f));

		mockSweepManager.emit('spectrum_data', {
			frequency: 98_000_000,
			timestamp: 1234,
			data: {
				powerValues: [-50, -45, -40, -35],
				startFreq: 96_000_000,
				endFreq: 100_000_000,
				timestamp: 1234
			}
		});

		expect(received).toHaveLength(1);
		const frame = received[0];
		expect(frame.device).toBe(HardwareDevice.HACKRF);
		expect(frame.startFreq).toBe(96_000_000);
		expect(frame.endFreq).toBe(100_000_000);
		expect(frame.binWidth).toBe(1_000_000); // (100-96 MHz) / 4 bins
		expect(frame.power).toEqual([-50, -45, -40, -35]);
		expect(frame.timestamp).toBe(1234);
	});

	it('drops malformed events (missing powerValues / freq bounds)', async () => {
		const src = new HackRFSpectrumSource();
		await src.start(baseConfig);

		const received: SpectrumFrame[] = [];
		src.on('frame', (f) => received.push(f));

		mockSweepManager.emit('spectrum_data', { data: {} });
		mockSweepManager.emit('spectrum_data', { data: { powerValues: [] } });
		mockSweepManager.emit('spectrum_data', {
			data: { powerValues: [1], startFreq: 100, endFreq: undefined }
		});

		expect(received).toHaveLength(0);
	});

	it('stop() calls sweepManager.stopSweep and detaches listener', async () => {
		const src = new HackRFSpectrumSource();
		await src.start(baseConfig);

		expect(mockSweepManager.listenerCount('spectrum_data')).toBe(1);

		await src.stop();

		expect(mockSweepManager.stopSweep).toHaveBeenCalledTimes(1);
		expect(mockSweepManager.listenerCount('spectrum_data')).toBe(0);
	});

	it("getStatus() reports state 'streaming' after start, 'idle' after stop", async () => {
		const src = new HackRFSpectrumSource();
		expect(src.getStatus().state).toBe('idle');

		await src.start(baseConfig);
		expect(src.getStatus().state).toBe('streaming');
		expect(src.getStatus().config).toEqual(baseConfig);

		await src.stop();
		expect(src.getStatus().state).toBe('idle');
	});

	it("transitions to 'error' when sweepManager.startCycle returns false", async () => {
		mockSweepManager.startCycle.mockResolvedValueOnce(false);
		const src = new HackRFSpectrumSource();

		await expect(src.start(baseConfig)).rejects.toThrow(/returned false/);
		expect(src.getStatus().state).toBe('error');
	});
});
