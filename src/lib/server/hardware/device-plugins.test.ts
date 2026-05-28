import { describe, expect, it } from 'vitest';

import { DEVICE_PLUGINS, getAllDevicePlugins, getDevicePlugin } from './device-plugins';
import { HardwareDevice } from './types';

describe('device-plugins registry', () => {
	it('wires B205, HackRF, and ALFA to plugins', () => {
		expect(getDevicePlugin(HardwareDevice.B205)).toBeDefined();
		expect(getDevicePlugin(HardwareDevice.HACKRF)).toBeDefined();
		expect(getDevicePlugin(HardwareDevice.ALFA)).toBeDefined();
	});

	it('returns undefined for the unwired BLUETOOTH enum entry', () => {
		// Documents the current state — Bluetooth has no manager yet.
		// Flipping this to `toBeDefined()` is the canary that a future
		// bluetooth-manager.ts has been registered.
		expect(getDevicePlugin(HardwareDevice.BLUETOOTH)).toBeUndefined();
	});

	it('matches each plugin id to its enum key', () => {
		for (const device of Object.keys(DEVICE_PLUGINS) as HardwareDevice[]) {
			const plugin = DEVICE_PLUGINS[device];
			expect(plugin?.id).toBe(device);
		}
	});

	it('getAllDevicePlugins returns every wired plugin', () => {
		const plugins = getAllDevicePlugins();
		expect(plugins).toHaveLength(3);
		const ids = plugins.map((p) => p.id).sort();
		expect(ids).toEqual(
			[HardwareDevice.ALFA, HardwareDevice.B205, HardwareDevice.HACKRF].sort()
		);
	});

	it('every wired plugin exposes the four contract methods', () => {
		for (const plugin of getAllDevicePlugins()) {
			expect(typeof plugin.displayName).toBe('string');
			expect(typeof plugin.detect).toBe('function');
			expect(typeof plugin.getBlockingProcesses).toBe('function');
			expect(typeof plugin.killHolders).toBe('function');
		}
	});
});
