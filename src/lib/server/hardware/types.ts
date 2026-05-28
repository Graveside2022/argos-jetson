export enum HardwareDevice {
	HACKRF = 'hackrf',
	ALFA = 'alfa',
	BLUETOOTH = 'bluetooth',
	B205 = 'b205'
}

export interface ResourceState {
	device: HardwareDevice;
	isAvailable: boolean;
	owner: string | null;
	connectedSince: number | null;
	isDetected: boolean;
}

export interface HardwareStatus {
	hackrf: ResourceState;
	alfa: ResourceState;
	bluetooth: ResourceState;
	b205: ResourceState;
}

/**
 * Contract every hardware device adapter satisfies. Slotting in a new SDR
 * (RTL-SDR, BladeRF, Sidekiq, RFNM, etc.) is a 3-file change:
 *   1. add the `HardwareDevice` enum entry above
 *   2. create `<device>-manager.ts` exporting `detect`, `getBlockingProcesses`,
 *      `killHolders` (and any device-specific helpers)
 *   3. add an entry to `DEVICE_PLUGINS` in `device-plugins.ts`
 *
 * `resource-scan.ts`, `resource-refresh.ts`, and `resource-manager.ts` iterate
 * the registry — no edits required.
 *
 * The optional `scanOrphans` + `refreshState` hooks let a device own its own
 * ownership-detection logic when it has extra sources beyond the standard
 * `getBlockingProcesses()` (HackRF has Docker containers, B205 has systemd
 * services + process-name canonicalization). When absent the orchestrator
 * uses a default flow: call `detect()` + `getBlockingProcesses()` and apply
 * the first process's `name` as the owner.
 */
export type HardwareDevicePlugin = {
	id: HardwareDevice;
	displayName: string;
	detect: () => Promise<boolean>;
	getBlockingProcesses: () => Promise<{ pid: string; name: string }[]>;
	killHolders: () => Promise<void>;
	/** Custom startup orphan-scan. Mutates `state` to record current ownership. */
	scanOrphans?: (state: Map<HardwareDevice, ResourceState>) => Promise<void>;
	/** Custom periodic refresh. Mutates `state` to reconcile against live OS data. */
	refreshState?: (state: Map<HardwareDevice, ResourceState>) => Promise<void>;
};
