import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { DetectedHardware, HardwareStatus } from './detection-types';
import { HardwareRegistry } from './hardware-registry';

vi.mock('$lib/utils/logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}));

function makeHw(overrides: Partial<DetectedHardware> = {}): DetectedHardware {
	return {
		id: 'hw-1',
		name: 'Default Device',
		category: 'sdr',
		connectionType: 'usb',
		status: 'connected',
		capabilities: {},
		...overrides
	};
}

describe('HardwareRegistry — register / unregister / get / has', () => {
	let reg: HardwareRegistry;
	beforeEach(() => {
		reg = new HardwareRegistry();
	});

	test('register stores hardware retrievable by id', () => {
		const hw = makeHw({ id: 'sdr-1', name: 'HackRF' });
		reg.register(hw);
		expect(reg.get('sdr-1')).toBe(hw);
	});

	test('register overwrites existing entry on duplicate id', () => {
		const first = makeHw({ id: 'dup', name: 'first' });
		const second = makeHw({ id: 'dup', name: 'second' });
		reg.register(first);
		reg.register(second);
		expect(reg.get('dup')).toBe(second);
		expect(reg.getAll()).toHaveLength(1);
	});

	test('registerBulk registers every hardware in array', () => {
		const list = [makeHw({ id: 'a' }), makeHw({ id: 'b' }), makeHw({ id: 'c' })];
		reg.registerBulk(list);
		expect(reg.getAll()).toHaveLength(3);
		expect(reg.has('a')).toBe(true);
		expect(reg.has('b')).toBe(true);
		expect(reg.has('c')).toBe(true);
	});

	test('registerBulk on empty array is a no-op', () => {
		reg.registerBulk([]);
		expect(reg.getAll()).toHaveLength(0);
	});

	test('unregister returns true when hardware existed', () => {
		reg.register(makeHw({ id: 'doomed' }));
		expect(reg.unregister('doomed')).toBe(true);
		expect(reg.has('doomed')).toBe(false);
	});

	test('unregister returns false for unknown id', () => {
		expect(reg.unregister('ghost')).toBe(false);
	});

	test('get returns undefined for unknown id', () => {
		expect(reg.get('ghost')).toBeUndefined();
	});

	test('has returns false for unknown id and true after register', () => {
		expect(reg.has('x')).toBe(false);
		reg.register(makeHw({ id: 'x' }));
		expect(reg.has('x')).toBe(true);
	});
});

describe('HardwareRegistry — getAll / query filters', () => {
	let reg: HardwareRegistry;
	const hackrf: DetectedHardware = makeHw({
		id: 'hackrf',
		name: 'HackRF One',
		category: 'sdr',
		connectionType: 'usb',
		status: 'connected',
		manufacturer: 'Great Scott Gadgets',
		compatibleTools: ['gnuradio', 'sdrpp']
	});
	const wifi: DetectedHardware = makeHw({
		id: 'wlan0',
		name: 'Alfa AWUS036',
		category: 'wifi',
		connectionType: 'usb',
		status: 'connected',
		manufacturer: 'Alfa',
		compatibleTools: ['kismet']
	});
	const gps: DetectedHardware = makeHw({
		id: 'gps-1',
		name: 'u-blox NEO-7M',
		category: 'gps',
		connectionType: 'serial',
		status: 'disconnected',
		manufacturer: 'u-blox',
		model: 'NEO-7M'
	});

	beforeEach(() => {
		reg = new HardwareRegistry();
		reg.registerBulk([hackrf, wifi, gps]);
	});

	test('getAll returns every registered device as a fresh array', () => {
		const all = reg.getAll();
		expect(all).toHaveLength(3);
		expect(all).toEqual(expect.arrayContaining([hackrf, wifi, gps]));
	});

	test('query with empty options returns all', () => {
		expect(reg.query()).toHaveLength(3);
	});

	test('query by category filters to matching devices only', () => {
		expect(reg.query({ category: 'sdr' })).toEqual([hackrf]);
		expect(reg.query({ category: 'wifi' })).toEqual([wifi]);
		expect(reg.query({ category: 'audio' })).toEqual([]);
	});

	test('query by connectionType filters correctly', () => {
		expect(reg.query({ connectionType: 'usb' })).toHaveLength(2);
		expect(reg.query({ connectionType: 'serial' })).toEqual([gps]);
		expect(reg.query({ connectionType: 'pci' })).toEqual([]);
	});

	test('query by status filters correctly', () => {
		expect(reg.query({ status: 'connected' })).toHaveLength(2);
		expect(reg.query({ status: 'disconnected' })).toEqual([gps]);
	});

	test('query with compatibleWithTool filters by compatibleTools includes', () => {
		expect(reg.query({ compatibleWithTool: 'gnuradio' })).toEqual([hackrf]);
		expect(reg.query({ compatibleWithTool: 'kismet' })).toEqual([wifi]);
		expect(reg.query({ compatibleWithTool: 'nonexistent' })).toEqual([]);
	});

	test('query with compatibleWithTool excludes devices missing compatibleTools', () => {
		expect(reg.query({ compatibleWithTool: 'any' })).not.toContain(gps);
	});

	test('query with search matches across name / id / manufacturer / model fields, case-insensitive', () => {
		expect(reg.query({ search: 'HACKRF' })).toEqual([hackrf]);
		expect(reg.query({ search: 'alfa' })).toEqual([wifi]);
		expect(reg.query({ search: 'u-blox' })).toEqual([gps]);
		expect(reg.query({ search: 'neo-7m' })).toEqual([gps]);
		expect(reg.query({ search: 'gps-1' })).toEqual([gps]);
	});

	test('query with search of empty string treated as no filter', () => {
		expect(reg.query({ search: '' })).toHaveLength(3);
	});

	test('query combines multiple filters with AND semantics', () => {
		expect(reg.query({ category: 'sdr', connectionType: 'usb', status: 'connected' })).toEqual([
			hackrf
		]);
		expect(reg.query({ category: 'wifi', status: 'disconnected' })).toEqual([]);
	});

	test('query search undefined field does not throw', () => {
		const noManuf = makeHw({ id: 'noman', name: 'Mystery' });
		reg.register(noManuf);
		expect(reg.query({ search: 'mystery' })).toEqual([noManuf]);
	});
});

describe('HardwareRegistry — getByCategory / getByConnectionType / getStats', () => {
	let reg: HardwareRegistry;

	beforeEach(() => {
		reg = new HardwareRegistry();
	});

	test('getByCategory on empty registry returns empty object', () => {
		expect(reg.getByCategory()).toEqual({});
	});

	test('getByCategory groups devices by their category field', () => {
		reg.registerBulk([
			makeHw({ id: 's1', category: 'sdr' }),
			makeHw({ id: 's2', category: 'sdr' }),
			makeHw({ id: 'w1', category: 'wifi' })
		]);
		const grouped = reg.getByCategory();
		expect(grouped.sdr).toHaveLength(2);
		expect(grouped.wifi).toHaveLength(1);
		expect(grouped.bluetooth).toBeUndefined();
	});

	test('getByConnectionType groups devices by their connectionType field', () => {
		reg.registerBulk([
			makeHw({ id: 'u1', connectionType: 'usb' }),
			makeHw({ id: 'u2', connectionType: 'usb' }),
			makeHw({ id: 'n1', connectionType: 'network' })
		]);
		const grouped = reg.getByConnectionType();
		expect(grouped.usb).toHaveLength(2);
		expect(grouped.network).toHaveLength(1);
	});

	test('getStats returns total + connected + per-category/connectionType/status counts', () => {
		reg.registerBulk([
			makeHw({ id: 'a', category: 'sdr', connectionType: 'usb', status: 'connected' }),
			makeHw({ id: 'b', category: 'sdr', connectionType: 'usb', status: 'disconnected' }),
			makeHw({ id: 'c', category: 'wifi', connectionType: 'usb', status: 'connected' }),
			makeHw({ id: 'd', category: 'gps', connectionType: 'serial', status: 'error' })
		]);
		const stats = reg.getStats();
		expect(stats.total).toBe(4);
		expect(stats.connected).toBe(2);
		expect(stats.byCategory.sdr).toBe(2);
		expect(stats.byCategory.wifi).toBe(1);
		expect(stats.byCategory.gps).toBe(1);
		expect(stats.byConnectionType.usb).toBe(3);
		expect(stats.byConnectionType.serial).toBe(1);
		expect(stats.byStatus.connected).toBe(2);
		expect(stats.byStatus.disconnected).toBe(1);
		expect(stats.byStatus.error).toBe(1);
	});

	test('getStats on empty registry returns zero counts', () => {
		const stats = reg.getStats();
		expect(stats.total).toBe(0);
		expect(stats.connected).toBe(0);
		expect(stats.byCategory).toEqual({});
		expect(stats.byConnectionType).toEqual({});
		expect(stats.byStatus).toEqual({});
	});
});

describe('HardwareRegistry — updateStatus / markConnected / markDisconnected / clear', () => {
	let reg: HardwareRegistry;
	beforeEach(() => {
		reg = new HardwareRegistry();
	});

	test('updateStatus returns true and sets new status + lastSeen for known id', () => {
		const before = Date.now();
		reg.register(makeHw({ id: 'a', status: 'disconnected' }));
		expect(reg.updateStatus('a', 'connected')).toBe(true);
		const hw = reg.get('a');
		if (!hw) throw new Error('expected hw');
		expect(hw.status).toBe('connected');
		expect(hw.lastSeen).toBeGreaterThanOrEqual(before);
	});

	test('updateStatus returns false and mutates nothing for unknown id', () => {
		expect(reg.updateStatus('ghost', 'connected')).toBe(false);
	});

	test('markConnected / markDisconnected return false for unknown id', () => {
		expect(reg.markConnected('ghost')).toBe(false);
		expect(reg.markDisconnected('ghost')).toBe(false);
	});

	test('clear removes every device', () => {
		reg.registerBulk([makeHw({ id: 'a' }), makeHw({ id: 'b' })]);
		expect(reg.getAll()).toHaveLength(2);
		reg.clear();
		expect(reg.getAll()).toHaveLength(0);
		expect(reg.has('a')).toBe(false);
		expect(reg.has('b')).toBe(false);
	});
});

describe('HardwareRegistry — category convenience getters', () => {
	let reg: HardwareRegistry;
	beforeEach(() => {
		reg = new HardwareRegistry();
	});

	test('getCompatibleWith returns only devices listing the tool id', () => {
		reg.registerBulk([
			makeHw({ id: 'a', compatibleTools: ['gnuradio', 'sdrpp'] }),
			makeHw({ id: 'b', compatibleTools: ['kismet'] }),
			makeHw({ id: 'c' })
		]);
		expect(reg.getCompatibleWith('sdrpp').map((hw) => hw.id)).toEqual(['a']);
		expect(reg.getCompatibleWith('kismet').map((hw) => hw.id)).toEqual(['b']);
		expect(reg.getCompatibleWith('absent')).toEqual([]);
	});

	test('hasCategory returns true only when at least one CONNECTED device of that category exists', () => {
		reg.register(makeHw({ id: 'a', category: 'sdr', status: 'connected' }));
		reg.register(makeHw({ id: 'b', category: 'wifi', status: 'disconnected' }));
		expect(reg.hasCategory('sdr')).toBe(true);
		expect(reg.hasCategory('wifi')).toBe(false);
		expect(reg.hasCategory('bluetooth')).toBe(false);
	});

	test('getSDRs returns only connected SDR devices', () => {
		reg.registerBulk([
			makeHw({ id: 'a', category: 'sdr', status: 'connected' }),
			makeHw({ id: 'b', category: 'sdr', status: 'disconnected' }),
			makeHw({ id: 'c', category: 'wifi', status: 'connected' })
		]);
		const sdrs = reg.getSDRs();
		expect(sdrs.map((hw) => hw.id)).toEqual(['a']);
	});

	test('getWiFiAdapters returns only connected wifi devices', () => {
		reg.registerBulk([
			makeHw({ id: 'a', category: 'wifi', status: 'connected' }),
			makeHw({ id: 'b', category: 'wifi', status: 'error' }),
			makeHw({ id: 'c', category: 'sdr', status: 'connected' })
		]);
		expect(reg.getWiFiAdapters().map((hw) => hw.id)).toEqual(['a']);
	});

	test('getBluetoothAdapters returns only connected bluetooth devices', () => {
		reg.registerBulk([
			makeHw({ id: 'a', category: 'bluetooth', status: 'connected' }),
			makeHw({ id: 'b', category: 'bluetooth', status: 'disconnected' })
		]);
		expect(reg.getBluetoothAdapters().map((hw) => hw.id)).toEqual(['a']);
	});

	test('getGPSModules returns only connected gps devices', () => {
		reg.registerBulk([
			makeHw({ id: 'a', category: 'gps', status: 'connected' }),
			makeHw({ id: 'b', category: 'gps', status: 'unknown' as HardwareStatus }),
			makeHw({ id: 'c', category: 'cellular', status: 'connected' })
		]);
		expect(reg.getGPSModules().map((hw) => hw.id)).toEqual(['a']);
	});
});

describe('HardwareRegistry — distinct-kill mutation guards', () => {
	let reg: HardwareRegistry;
	beforeEach(() => {
		reg = new HardwareRegistry();
	});

	test('hasCategory uses `&&` not `||` — disconnected device of category fails', () => {
		reg.register(makeHw({ id: 'a', category: 'sdr', status: 'disconnected' }));
		expect(reg.hasCategory('sdr')).toBe(false);
	});

	test('updateStatus updates lastSeen ONLY when id matches', () => {
		reg.register(makeHw({ id: 'tracked', lastSeen: 1 }));
		const before = reg.get('tracked')?.lastSeen;
		reg.updateStatus('ghost', 'connected');
		expect(reg.get('tracked')?.lastSeen).toBe(before);
	});

	test('search lowercases query, not field — mixed-case stored value still matches', () => {
		reg.register(makeHw({ id: 'a', name: 'MixedCase' }));
		expect(reg.query({ search: 'mixedcase' })).toHaveLength(1);
		expect(reg.query({ search: 'MIXEDCASE' })).toHaveLength(1);
	});

	test('search needs full substring — empty search is no-op, not match-all-strict', () => {
		reg.register(makeHw({ id: 'a', name: 'foo' }));
		expect(reg.query({ search: 'fo' })).toHaveLength(1);
		expect(reg.query({ search: 'foox' })).toHaveLength(0);
	});

	test('register triggers logger.debug exactly once per call with [HardwareRegistry] tag', async () => {
		const { logger } = await import('$lib/utils/logger');
		(logger.debug as ReturnType<typeof vi.fn>).mockClear();
		reg.register(makeHw({ id: 'a' }));
		expect(logger.debug).toHaveBeenCalledTimes(1);
		expect(logger.debug).toHaveBeenCalledWith(
			expect.stringContaining('[HardwareRegistry]'),
			expect.anything(),
			expect.anything()
		);
	});

	test('unregister of unknown id does NOT call logger.debug', async () => {
		const { logger } = await import('$lib/utils/logger');
		(logger.debug as ReturnType<typeof vi.fn>).mockClear();
		reg.unregister('ghost');
		expect(logger.debug).not.toHaveBeenCalled();
	});

	test('unregister of KNOWN id calls logger.debug with [HardwareRegistry] tag', async () => {
		const { logger } = await import('$lib/utils/logger');
		reg.register(makeHw({ id: 'a' }));
		(logger.debug as ReturnType<typeof vi.fn>).mockClear();
		reg.unregister('a');
		expect(logger.debug).toHaveBeenCalledWith(
			expect.stringContaining('[HardwareRegistry]'),
			expect.anything()
		);
	});

	test('clear triggers logger.info exactly once with [HardwareRegistry] tag', async () => {
		const { logger } = await import('$lib/utils/logger');
		(logger.info as ReturnType<typeof vi.fn>).mockClear();
		reg.clear();
		expect(logger.info).toHaveBeenCalledTimes(1);
		expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[HardwareRegistry]'));
	});

	test('updateStatus mutates the SAME object reference returned by prior get()', () => {
		// Documents current behavior: HardwareRegistry stores by reference and
		// mutates in-place inside updateStatus. A handle obtained via get()
		// before the update sees the new status — no immutable snapshot is
		// returned. If this changes (e.g. structural sharing or freezing),
		// downstream code that aliases get()'s return must be updated.
		reg.register(makeHw({ id: 'a', status: 'disconnected' }));
		const handle = reg.get('a');
		if (!handle) throw new Error('expected registered hw');
		expect(handle.status).toBe('disconnected');
		reg.updateStatus('a', 'connected');
		expect(handle.status).toBe('connected');
	});

	test('getByCategory().bluetooth is `undefined` at runtime when no bluetooth device registered', () => {
		// Static type is Record<HardwareCategory, DetectedHardware[]> via a
		// type-cast at the return site, but the runtime value is built from a
		// Partial<Record<...>>. Accessing an unregistered category yields
		// `undefined`, not an empty array. Callers MUST narrow before iterating.
		reg.register(makeHw({ id: 'sdr-only', category: 'sdr' }));
		const grouped = reg.getByCategory();
		expect(grouped.bluetooth).toBeUndefined();
		expect(grouped.sdr).toHaveLength(1);
	});
});
