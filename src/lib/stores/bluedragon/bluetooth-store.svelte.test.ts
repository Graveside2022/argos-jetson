import { describe, expect, it } from 'vitest';

import type { BluetoothDevice } from '$lib/types/bluedragon';

import { applyBluetoothDevices, bluetoothStore } from './bluetooth-store.svelte';

const dev = (addr: string): BluetoothDevice => ({ addr, name: addr }) as unknown as BluetoothDevice;

describe('bluetooth-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('defaults to stopped with empty devices', () => {
		bluetoothStore.set({
			status: 'stopped',
			pid: null,
			startedAt: null,
			packetCount: 0,
			deviceCount: 0,
			profile: null,
			devices: new Map(),
			error: null,
			lastUpdated: null
		});
		expect(bluetoothStore.current.status).toBe('stopped');
		expect(bluetoothStore.current.devices.size).toBe(0);
	});

	it('applyBluetoothDevices replaces the device map + count', () => {
		applyBluetoothDevices([dev('AA:BB'), dev('CC:DD')]);
		expect(bluetoothStore.current.devices.size).toBe(2);
		expect(bluetoothStore.current.deviceCount).toBe(2);
		expect(bluetoothStore.current.devices.get('AA:BB')).toBeTruthy();
	});
});
