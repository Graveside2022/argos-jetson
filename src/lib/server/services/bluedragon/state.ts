/**
 * Blue Dragon runtime state — mutable singleton shared across peer modules
 * (`lifecycle`, `events`). Centralised here so no peer owns its own `let`
 * and so status readers (`getBluedragonStatusSync`) always see a coherent
 * snapshot.
 *
 * @module
 */

import type { ChildProcess } from 'node:child_process';

import type {
	BluedragonOptions,
	BluedragonProfile,
	BluedragonStatusResult,
	BluetoothDevice
} from '$lib/types/bluedragon';

import type { DeviceAggregator } from './device-aggregator';
import type { PcapStreamParser } from './pcap-stream-parser';
import type { PersistenceHandle } from './signal-persistence';

export interface RuntimeState {
	process: ChildProcess | null;
	parser: PcapStreamParser | null;
	aggregator: DeviceAggregator | null;
	pid: number | null;
	startedAt: number | null;
	profile: BluedragonProfile | null;
	options: BluedragonOptions | null;
	status: 'stopped' | 'starting' | 'running' | 'stopping';
	parserStartTimer: ReturnType<typeof setTimeout> | null;
	frozenDevices: BluetoothDevice[];
	frozenPacketCount: number;
	persistence: PersistenceHandle | null;
}

export const state: RuntimeState = {
	process: null,
	parser: null,
	aggregator: null,
	pid: null,
	startedAt: null,
	profile: null,
	options: null,
	status: 'stopped',
	parserStartTimer: null,
	frozenDevices: [],
	frozenPacketCount: 0,
	persistence: null
};

export function isBluedragonActive(): boolean {
	return state.status === 'running' || state.status === 'starting';
}

function currentPacketCount(): number {
	if (isBluedragonActive()) return state.aggregator?.getPacketCount() ?? 0;
	return state.frozenPacketCount;
}

function currentDeviceCount(): number {
	if (isBluedragonActive()) return state.aggregator?.getDeviceCount() ?? 0;
	return state.frozenDevices.length;
}

/** Snapshot the current active-device list + packet count into `frozen*`. */
export function freezeDeviceSnapshot(): void {
	state.frozenDevices = state.aggregator?.getSnapshot() ?? [];
	state.frozenPacketCount = state.aggregator?.getPacketCount() ?? 0;
}

/** Reset frozen counters — used on `resetBluedragonDevices`. */
export function resetFrozenSnapshot(): void {
	state.frozenDevices = [];
	state.frozenPacketCount = 0;
}

export function getBluedragonStatusSync(): BluedragonStatusResult {
	return {
		success: true,
		isRunning: isBluedragonActive(),
		status: state.status,
		pid: state.pid,
		startedAt: state.startedAt,
		packetCount: currentPacketCount(),
		deviceCount: currentDeviceCount(),
		profile: state.profile,
		options: state.options
	};
}

export function getBluedragonDevices(): BluetoothDevice[] {
	if (state.aggregator) return state.aggregator.getSnapshot();
	return state.frozenDevices;
}
