/**
 * Thin orchestrator owning the live `ResourceState` + mutex maps and the
 * public API consumed by 19+ callers across `src/**`. All device-specific
 * refresh, ownership reconciliation, mutex mechanics, and orphan scans
 * are delegated to peer modules:
 *
 *   - `./resource-ownership` — pure ownership reconciliation
 *   - `./resource-refresh`   — per-device OS refresh + kill paths
 *   - `./resource-mutex`     — cooperative mutex helpers
 *   - `./resource-scan`      — one-shot orphan scan at startup
 *
 * Public surface (callers rely on): `resourceManager` singleton with
 * `acquire`, `release`, `forceRelease`, `refreshNow`, `getStatus`,
 * `isAvailable`, `getOwner`, `dispose`, and EventEmitter events
 * `acquired` / `released` / `force-released`.
 *
 * @module
 */

import { EventEmitter } from 'events';

import { logger } from '$lib/utils/logger';

import { acquireMutex, releaseMutex } from './resource-mutex';
import { dispatchRefresh, killDeviceHolders, refreshDetection } from './resource-refresh';
import { scanForOrphans } from './resource-scan';
import { HardwareDevice, type HardwareStatus, type ResourceState } from './types';

const REFRESH_INTERVAL_MS = 30000;

class ResourceManager extends EventEmitter {
	private state: Map<HardwareDevice, ResourceState> = new Map();
	private mutex: Map<HardwareDevice, boolean> = new Map();
	private refreshInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		super();
		this.initializeState();
		scanForOrphans(this.state);
		// Re-scan periodically to keep isDetected status fresh
		this.refreshInterval = setInterval(() => {
			void refreshDetection(this.state);
		}, REFRESH_INTERVAL_MS);
	}

	dispose(): void {
		if (this.refreshInterval !== null) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private initializeState(): void {
		for (const device of Object.values(HardwareDevice)) {
			this.state.set(device, {
				device,
				isAvailable: true,
				owner: null,
				connectedSince: null,
				isDetected: false
			});
			this.mutex.set(device, false);
		}
	}

	async refreshNow(device: HardwareDevice): Promise<void> {
		try {
			await dispatchRefresh(this.state, device);
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.warn(
				'[ResourceManager] On-demand refresh failed',
				{ device, error: msg, operation: 'hardware.refreshNow' },
				'resource-refresh'
			);
		}
	}

	private checkExistingOwnership(
		toolName: string,
		current: ResourceState
	): { success: boolean; owner?: string } | null {
		if (!current.isAvailable && current.owner === toolName) {
			return { success: true, owner: toolName };
		}
		if (!current.isAvailable) {
			return { success: false, owner: current.owner ?? 'unknown' };
		}
		return null;
	}

	private tryClaim(
		toolName: string,
		device: HardwareDevice
	): { success: boolean; owner?: string } {
		const current = this.state.get(device);
		if (!current) {
			return { success: false, owner: 'device-not-found' };
		}
		const existing = this.checkExistingOwnership(toolName, current);
		if (existing) return existing;
		this.state.set(device, {
			device,
			isAvailable: false,
			owner: toolName,
			connectedSince: Date.now(),
			isDetected: current.isDetected
		});
		this.emit('acquired', { device, toolName });
		return { success: true };
	}

	async acquire(
		toolName: string,
		device: HardwareDevice
	): Promise<{ success: boolean; owner?: string }> {
		const gotMutex = await acquireMutex(this.mutex, device);
		if (!gotMutex) {
			return { success: false, owner: 'mutex-timeout' };
		}
		try {
			// Re-scan OS state before claiming so a stale cached "owner"
			// (e.g. a transient pgrep self-match that has since exited)
			// cannot block a legitimate acquire until the next 30s tick.
			// Failure here (e.g. a flaky pgrep) falls through to tryClaim
			// which reads whatever cache is present.
			await dispatchRefresh(this.state, device).catch(() => undefined);
			return this.tryClaim(toolName, device);
		} finally {
			releaseMutex(this.mutex, device);
		}
	}

	async release(
		toolName: string,
		device: HardwareDevice
	): Promise<{ success: boolean; error?: string }> {
		const gotMutex = await acquireMutex(this.mutex, device);
		if (!gotMutex) {
			return { success: false, error: 'mutex-timeout' };
		}

		try {
			const current = this.state.get(device);
			if (!current) {
				return { success: false, error: 'device-not-found' };
			}
			if (current.owner !== toolName) {
				return {
					success: false,
					error: `Not owner. Current owner: ${current.owner}`
				};
			}

			this.state.set(device, {
				device,
				isAvailable: true,
				owner: null,
				connectedSince: null,
				isDetected: current.isDetected
			});

			this.emit('released', { device, toolName });
			return { success: true };
		} finally {
			releaseMutex(this.mutex, device);
		}
	}

	async forceRelease(device: HardwareDevice): Promise<{ success: boolean }> {
		const gotMutex = await acquireMutex(this.mutex, device);
		if (!gotMutex) {
			return { success: false };
		}

		try {
			const current = this.state.get(device);
			if (!current) {
				return { success: false };
			}
			const previousOwner = current.owner;

			await killDeviceHolders(device);

			this.state.set(device, {
				device,
				isAvailable: true,
				owner: null,
				connectedSince: null,
				isDetected: current.isDetected
			});

			this.emit('force-released', { device, previousOwner });
			return { success: true };
		} finally {
			releaseMutex(this.mutex, device);
		}
	}

	getStatus(): HardwareStatus {
		const hackrf = this.state.get(HardwareDevice.HACKRF);
		const alfa = this.state.get(HardwareDevice.ALFA);
		const bluetooth = this.state.get(HardwareDevice.BLUETOOTH);
		const b205 = this.state.get(HardwareDevice.B205);

		if (!hackrf || !alfa || !bluetooth || !b205) {
			throw new Error('Hardware state not initialized');
		}

		return {
			hackrf: { ...hackrf },
			alfa: { ...alfa },
			bluetooth: { ...bluetooth },
			b205: { ...b205 }
		};
	}

	isAvailable(device: HardwareDevice): boolean {
		return this.state.get(device)?.isAvailable ?? false;
	}

	getOwner(device: HardwareDevice): string | null {
		return this.state.get(device)?.owner ?? null;
	}
}

// Singleton
export const resourceManager = new ResourceManager();
