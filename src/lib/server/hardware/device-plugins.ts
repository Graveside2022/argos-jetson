/**
 * Hardware device plugin registry.
 *
 * Each entry adapts a per-device manager file (b205-manager.ts,
 * hackrf-manager.ts, alfa-manager.ts) into the common
 * {@link HardwareDevicePlugin} shape so the orchestrator
 * (resource-manager + resource-scan + resource-refresh) is device-agnostic.
 *
 * Plugin-owned scan/refresh hooks live here. Adding a new SDR is now a
 * 3-file change — enum entry in `types.ts`, new `<device>-manager.ts`,
 * and a new entry below. No edits to `resource-scan.ts` /
 * `resource-refresh.ts` / `resource-manager.ts` core paths.
 *
 * @module
 */

import * as alfaMgr from './alfa-manager';
import * as b205Mgr from './b205-manager';
import { canonicalizeB205Owner } from './b205-owner-aliases';
import * as hackrfMgr from './hackrf-manager';
import { applyOwnership, resolveHackrfOwner } from './resource-ownership';
import { HardwareDevice, type HardwareDevicePlugin, type ResourceState } from './types';

// ─────────────────────────── shared scan/refresh helpers ───────────────────

function buildOwnedState(device: HardwareDevice, owner: string, detected: boolean): ResourceState {
	return {
		device,
		isAvailable: false,
		owner,
		connectedSince: Date.now(),
		isDetected: detected
	};
}

function updateDetection(
	state: Map<HardwareDevice, ResourceState>,
	device: HardwareDevice,
	detected: boolean
): void {
	const current = state.get(device);
	if (!current) return;
	current.isDetected = detected;
	state.set(device, current);
}

function serviceOwnerOrNull(services: { isActive: boolean; name: string }[]): string | null {
	const activeSvc = services.find((s) => s.isActive);
	return activeSvc ? activeSvc.name.replace(/\.service$/, '') : null;
}

// ─────────────────────────────── B205 plugin ──────────────────────────────

const b205Plugin: HardwareDevicePlugin = {
	id: HardwareDevice.B205,
	displayName: 'USRP B205mini',
	detect: b205Mgr.detectB205,
	getBlockingProcesses: b205Mgr.getB205BlockingProcesses,
	killHolders: b205Mgr.killB205BlockingProcesses,
	async scanOrphans(state) {
		const detected = await b205Mgr.detectB205();
		const processes = await b205Mgr.getB205BlockingProcesses();
		if (processes.length > 0) {
			const owner = canonicalizeB205Owner(processes[0].name);
			state.set(HardwareDevice.B205, buildOwnedState(HardwareDevice.B205, owner, detected));
			return;
		}
		const services = await b205Mgr.getServiceStatus();
		const svcOwner = serviceOwnerOrNull(services);
		if (svcOwner) {
			state.set(
				HardwareDevice.B205,
				buildOwnedState(HardwareDevice.B205, svcOwner, detected)
			);
			return;
		}
		updateDetection(state, HardwareDevice.B205, detected);
	},
	async refreshState(state) {
		const current = state.get(HardwareDevice.B205);
		if (!current) return;
		current.isDetected = await b205Mgr.detectB205();
		const processes = await b205Mgr.getB205BlockingProcesses();
		const services = await b205Mgr.getServiceStatus();
		const procOwner = processes.length > 0 ? canonicalizeB205Owner(processes[0].name) : null;
		const owner = procOwner ?? serviceOwnerOrNull(services);
		applyOwnership(current, owner);
		state.set(HardwareDevice.B205, current);
	}
};

// ───────────────────────────── HackRF plugin ──────────────────────────────

const hackrfPlugin: HardwareDevicePlugin = {
	id: HardwareDevice.HACKRF,
	displayName: 'HackRF One',
	detect: hackrfMgr.detectHackRF,
	getBlockingProcesses: hackrfMgr.getHackrfBlockingProcesses,
	killHolders: hackrfMgr.killHackrfBlockingProcesses,
	async scanOrphans(state) {
		const detected = await hackrfMgr.detectHackRF();
		const processes = await hackrfMgr.getHackrfBlockingProcesses();
		if (processes.length > 0) {
			state.set(
				HardwareDevice.HACKRF,
				buildOwnedState(HardwareDevice.HACKRF, processes[0].name, detected)
			);
			return;
		}
		// HackRF-specific extra source: Docker containers (gqrx, openwebrx, etc.)
		const containers = await hackrfMgr.getContainerStatus(true);
		const running = containers.find((c) => c.isRunning);
		if (running) {
			state.set(
				HardwareDevice.HACKRF,
				buildOwnedState(HardwareDevice.HACKRF, running.name, detected)
			);
			return;
		}
		updateDetection(state, HardwareDevice.HACKRF, detected);
	},
	async refreshState(state) {
		const current = state.get(HardwareDevice.HACKRF);
		if (!current) return;
		current.isDetected = await hackrfMgr.detectHackRF();
		const processes = await hackrfMgr.getHackrfBlockingProcesses();
		const containers = await hackrfMgr.getContainerStatus(true);
		applyOwnership(current, resolveHackrfOwner(processes, containers));
		state.set(HardwareDevice.HACKRF, current);
	}
};

// ───────────────────────────── ALFA plugin ────────────────────────────────

const alfaPlugin: HardwareDevicePlugin = {
	id: HardwareDevice.ALFA,
	displayName: 'ALFA AWUS036 WiFi Adapter',
	// alfa-manager exposes detectAdapter() returning the interface name or
	// null; adapt to the boolean detect contract here.
	detect: async () => (await alfaMgr.detectAdapter()) !== null,
	getBlockingProcesses: alfaMgr.getAlfaBlockingProcesses,
	killHolders: alfaMgr.killAlfaBlockingProcesses,
	async scanOrphans(state) {
		const iface = await alfaMgr.detectAdapter();
		const detected = !!iface;
		const processes = await alfaMgr.getAlfaBlockingProcesses();
		if (processes.length > 0) {
			state.set(
				HardwareDevice.ALFA,
				buildOwnedState(HardwareDevice.ALFA, processes[0].name, detected)
			);
			return;
		}
		updateDetection(state, HardwareDevice.ALFA, detected);
	},
	async refreshState(state) {
		const current = state.get(HardwareDevice.ALFA);
		if (!current) return;
		current.isDetected = !!(await alfaMgr.detectAdapter());
		const processes = await alfaMgr.getAlfaBlockingProcesses();
		const owner = processes.length > 0 ? processes[0].name : null;
		applyOwnership(current, owner);
		state.set(HardwareDevice.ALFA, current);
	}
};

// ─────────────────────────── registry + helpers ───────────────────────────

/**
 * Plugin registry keyed by `HardwareDevice`. `Partial` because
 * {@link HardwareDevice.BLUETOOTH} has no dedicated manager file yet —
 * the enum entry is reserved. Add the bluetooth entry once a
 * `bluetooth-manager.ts` ships.
 */
export const DEVICE_PLUGINS: Partial<Record<HardwareDevice, HardwareDevicePlugin>> = {
	[HardwareDevice.B205]: b205Plugin,
	[HardwareDevice.HACKRF]: hackrfPlugin,
	[HardwareDevice.ALFA]: alfaPlugin
};

/** Returns the plugin for `device`, or undefined if no manager wired yet. */
export function getDevicePlugin(device: HardwareDevice): HardwareDevicePlugin | undefined {
	return DEVICE_PLUGINS[device];
}

/** Convenience iterator for callers that want every wired plugin. */
export function getAllDevicePlugins(): HardwareDevicePlugin[] {
	return Object.values(DEVICE_PLUGINS).filter((p): p is HardwareDevicePlugin => p !== undefined);
}
