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

/**
 * Async stop callback registered by a hardware owner. Invoked by
 * `acquireWithPreempt` when a different tool requests the same device and
 * the owner has opted into graceful pre-emption. The callback MUST release
 * the device (typically by calling `resourceManager.release(...)` from
 * inside the owner's normal stop flow) — it MUST NOT itself call
 * `acquireWithPreempt`, which would deadlock the device mutex.
 */
export type PreemptHandler = () => Promise<void>;

/**
 * Maximum time `acquireWithPreempt` waits for a registered handler to release
 * the device. Sized for the slowest current preempt target: gnss-sdr-vnc's
 * 7-process serial teardown (xvnc + openbox + gnss-sdr + rtknavi + monitor +
 * websockify + socat) measures ~5.1s on Jetson under load, so 5000 raced the
 * SIGTERM grace. Bumped to 15s to absorb that path with margin while still
 * bounding stuck-owner recovery to a single TCP-keepalive cycle.
 */
const PREEMPT_HANDLER_TIMEOUT_MS = 15000;

export class ResourceManager extends EventEmitter {
	private state: Map<HardwareDevice, ResourceState> = new Map();
	private mutex: Map<HardwareDevice, boolean> = new Map();
	private refreshInterval: ReturnType<typeof setInterval> | null = null;
	private skipOsRefresh: boolean;
	// Keyed by `${toolName}:${device}` so a single tool can register handlers
	// for multiple devices without collision.
	private preemptHandlers: Map<string, PreemptHandler> = new Map();
	// Tracks an in-flight preempt run keyed by `${previousOwner}:${device}` so
	// concurrent `acquireWithPreempt` callers that target the same owner share
	// a single handler invocation instead of double-firing. Value resolves to
	// `true` if the handler completed cleanly, `false` if it threw or timed
	// out. Entry is removed once the handler settles.
	private preemptInFlight: Map<string, Promise<boolean>> = new Map();

	constructor(opts: { startRefreshLoop?: boolean; skipOsRefresh?: boolean } = {}) {
		super();
		this.skipOsRefresh = opts.skipOsRefresh === true;
		this.initializeState();
		if (opts.startRefreshLoop !== false) {
			scanForOrphans(this.state);
			this.refreshInterval = setInterval(() => {
				void refreshDetection(this.state);
			}, REFRESH_INTERVAL_MS);
		}
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
			if (!this.skipOsRefresh) {
				await dispatchRefresh(this.state, device).catch(() => undefined);
			}
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

	/**
	 * Register a graceful-stop callback for `toolName` on `device`. The
	 * handler is invoked by {@link acquireWithPreempt} when another tool
	 * requests the same device. Replaces any previous handler for the same
	 * `(toolName, device)` pair (last-writer wins).
	 */
	registerPreemptHandler(
		toolName: string,
		device: HardwareDevice,
		handler: PreemptHandler
	): void {
		this.preemptHandlers.set(`${toolName}:${device}`, handler);
	}

	/** Remove the preempt handler for `(toolName, device)`. Idempotent. */
	unregisterPreemptHandler(toolName: string, device: HardwareDevice): void {
		this.preemptHandlers.delete(`${toolName}:${device}`);
	}

	private findPreemptTarget(
		toolName: string,
		device: HardwareDevice,
		conflict: { success: boolean; owner?: string }
	): { previousOwner: string; handler: PreemptHandler } | null {
		const previousOwner = conflict.owner;
		if (!previousOwner || previousOwner === toolName) return null;
		const handler = this.preemptHandlers.get(`${previousOwner}:${device}`);
		if (!handler) return null;
		return { previousOwner, handler };
	}

	private async runPreemptHandler(
		handler: PreemptHandler,
		previousOwner: string,
		device: HardwareDevice
	): Promise<boolean> {
		// Race the handler against PREEMPT_HANDLER_TIMEOUT_MS so a stuck owner
		// can't hang every future requester forever. On timeout we log + return
		// false; the calling acquireWithPreempt will fall through with the
		// original conflict result so the caller sees a real error.
		let timer: ReturnType<typeof setTimeout> | null = null;
		const timeout = new Promise<'timeout'>((resolve) => {
			timer = setTimeout(() => resolve('timeout'), PREEMPT_HANDLER_TIMEOUT_MS);
		});
		try {
			const result = await Promise.race([handler().then(() => 'ok' as const), timeout]);
			if (result === 'timeout') {
				logger.warn('[ResourceManager] preempt handler timed out', {
					previousOwner,
					device,
					timeoutMs: PREEMPT_HANDLER_TIMEOUT_MS
				});
				return false;
			}
			return true;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn('[ResourceManager] preempt handler threw', {
				previousOwner,
				device,
				err: msg
			});
			return false;
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	/**
	 * Coalesce concurrent preempts of the same owner. The first caller fires
	 * the handler; subsequent callers `await` the same in-flight Promise.
	 * Cleans up the registry entry once the handler settles so the next
	 * preempt cycle starts fresh.
	 */
	private async runPreemptOnce(
		handler: PreemptHandler,
		previousOwner: string,
		device: HardwareDevice
	): Promise<boolean> {
		const key = `${previousOwner}:${device}`;
		const existing = this.preemptInFlight.get(key);
		if (existing) return existing;
		const promise = this.runPreemptHandler(handler, previousOwner, device).finally(() => {
			this.preemptInFlight.delete(key);
		});
		this.preemptInFlight.set(key, promise);
		return promise;
	}

	/**
	 * Acquire `device` for `toolName` with cooperative pre-emption. Behaves
	 * exactly like {@link acquire} on the happy path. On conflict, if the
	 * current owner has registered a preempt handler we invoke it (releasing
	 * the device mutex first so the handler's own release call can take it),
	 * then retry the acquire once. If still locked we return the original
	 * conflict result with `success: false`.
	 *
	 * If the previous owner has NO registered handler the owner is treated as
	 * an "orphan" — most commonly a stale ownership row left over from the
	 * 30s OS scan after a prior Argos process exited without releasing. By
	 * default we still return the conflict so the operator can investigate.
	 * Pass `forceOnOrphan: true` to fall back to {@link forceRelease} (which
	 * kills any surviving holder via {@link killDeviceHolders}) and retry —
	 * the right behavior for noVNC + dragonsync where the orphan is provably
	 * us-from-a-prior-process and we have already chosen to take the device.
	 *
	 * Returns `preempted: <previousOwner>` on the cooperative-success path
	 * and `preempted: <previousOwner>` + `forcedOnOrphan: true` on the
	 * force-fallback path so the caller can log the handoff for the operator.
	 */
	// Branching here is the cooperative-preempt protocol (happy-path, preempt
	// target found, forceOnOrphan fallback, retry-after-handler) — splitting
	// it just to satisfy the complexity rule would hide the protocol's flow.
	// eslint-disable-next-line complexity, sonarjs/cognitive-complexity
	async acquireWithPreempt(
		toolName: string,
		device: HardwareDevice,
		options: { forceOnOrphan?: boolean } = {}
	): Promise<{
		success: boolean;
		owner?: string;
		preempted?: string;
		forcedOnOrphan?: boolean;
	}> {
		const first = await this.acquire(toolName, device);
		if (first.success) return first;
		const target = this.findPreemptTarget(toolName, device, first);
		if (!target) {
			if (!options.forceOnOrphan || !first.owner || first.owner === toolName) {
				return first;
			}
			logger.warn('[ResourceManager] orphan owner — force-release-and-retry', {
				requester: toolName,
				orphanOwner: first.owner,
				device
			});
			const forced = await this.forceRelease(device);
			if (!forced.success) return first;
			const retry = await this.acquire(toolName, device);
			if (retry.success) {
				return { ...retry, preempted: first.owner, forcedOnOrphan: true };
			}
			return retry;
		}
		logger.info('[ResourceManager] preempting current owner', {
			requester: toolName,
			previousOwner: target.previousOwner,
			device
		});
		if (!(await this.runPreemptOnce(target.handler, target.previousOwner, device))) {
			return first;
		}
		const second = await this.acquire(toolName, device);
		if (second.success) return { ...second, preempted: target.previousOwner };
		return second;
	}
}

// Singleton
export const resourceManager = new ResourceManager();
