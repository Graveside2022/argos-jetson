import type {
	BluedragonOptions,
	BluedragonProfile,
	BluedragonStatus,
	BluedragonStatusResult,
	BluetoothDevice
} from '$lib/types/bluedragon';

import { createControlClient } from '../control-client';

interface BluetoothState {
	status: BluedragonStatus;
	pid: number | null;
	startedAt: number | null;
	packetCount: number;
	deviceCount: number;
	profile: BluedragonProfile | null;
	devices: Map<string, BluetoothDevice>;
	error: string | null;
	lastUpdated: number | null;
}

const INITIAL_STATE: BluetoothState = {
	status: 'stopped',
	pid: null,
	startedAt: null,
	packetCount: 0,
	deviceCount: 0,
	profile: null,
	devices: new Map(),
	error: null,
	lastUpdated: null
};

// $state.raw: state (and its device Map) is replaced wholesale on every update.
let btValue = $state.raw<BluetoothState>({
	...INITIAL_STATE,
	devices: new Map()
});
export const bluetoothStore = {
	get current(): BluetoothState {
		return btValue;
	},
	set(value: BluetoothState): void {
		btValue = value;
	}
};

function applyBluetoothStatus(status: BluedragonStatusResult): void {
	bluetoothStore.set({
		...bluetoothStore.current,
		status: status.status,
		pid: status.pid,
		startedAt: status.startedAt,
		packetCount: status.packetCount,
		deviceCount: status.deviceCount,
		profile: status.profile,
		error: null,
		lastUpdated: Date.now()
	});
}

export function applyBluetoothDevices(devices: BluetoothDevice[]): void {
	const map = new Map<string, BluetoothDevice>();
	for (const device of devices) {
		map.set(device.addr, device);
	}
	bluetoothStore.set({
		...bluetoothStore.current,
		devices: map,
		deviceCount: map.size,
		lastUpdated: Date.now()
	});
}

function setBluetoothError(err: string): void {
	bluetoothStore.set({ ...bluetoothStore.current, error: err });
}

export async function fetchBluetoothStatus(): Promise<void> {
	try {
		const res = await fetch('/api/bluedragon/status', { credentials: 'same-origin' });
		if (!res.ok) throw new Error(`status ${res.status}`);
		const data = (await res.json()) as BluedragonStatusResult;
		applyBluetoothStatus(data);
	} catch (err) {
		setBluetoothError(err instanceof Error ? err.message : 'status fetch failed');
	}
}

// fallow-ignore-next-line complexity
export async function fetchBluetoothDevices(): Promise<void> {
	try {
		const res = await fetch('/api/bluedragon/devices', { credentials: 'same-origin' });
		if (!res.ok) throw new Error(`devices ${res.status}`);
		const data = (await res.json()) as { success: boolean; devices: BluetoothDevice[] };
		if (data.success) applyBluetoothDevices(data.devices);
	} catch (err) {
		setBluetoothError(err instanceof Error ? err.message : 'devices fetch failed');
	}
}

const runControl = createControlClient('/api/bluedragon/control', {
	setError: setBluetoothError,
	refreshStatus: fetchBluetoothStatus
});

export async function startBluedragonFromUi(
	profile: BluedragonProfile = 'volume',
	options: BluedragonOptions = {}
): Promise<boolean> {
	return runControl({ action: 'start', profile, options }, 'start request failed');
}

export async function stopBluedragonFromUi(): Promise<boolean> {
	return runControl({ action: 'stop' }, 'stop request failed');
}
