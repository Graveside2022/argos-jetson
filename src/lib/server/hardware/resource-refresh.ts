/**
 * Per-device OS-state refresh + force-release kill paths. Operates on a
 * plain `Map<HardwareDevice, ResourceState>` that the orchestrator passes
 * in. Iterates the plugin registry; device-specific refresh logic lives
 * on each `HardwareDevicePlugin.refreshState` hook.
 *
 * @module
 */

import { logger } from '$lib/utils/logger';

import { getAllDevicePlugins, getDevicePlugin } from './device-plugins';
import { HardwareDevice, type HardwareDevicePlugin, type ResourceState } from './types';

type StateMap = Map<HardwareDevice, ResourceState>;

async function refreshOnePlugin(state: StateMap, plugin: HardwareDevicePlugin): Promise<void> {
	if (!plugin.refreshState) return;
	try {
		await plugin.refreshState(state);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn(
			'[ResourceManager] Hardware detection refresh failed',
			{ device: plugin.id, error: msg, operation: 'hardware.detect' },
			'resource-detect'
		);
	}
}

/** Refresh detection + ownership for every registered device. */
export async function refreshDetection(state: StateMap): Promise<void> {
	for (const plugin of getAllDevicePlugins()) {
		await refreshOnePlugin(state, plugin);
	}
}

/**
 * On-demand refresh of a single device's detection state. Call after a
 * docker/process lifecycle command so that the next status poll returns
 * fresh data without waiting up to 30s for the scheduled refresh.
 */
export async function dispatchRefresh(state: StateMap, device: HardwareDevice): Promise<void> {
	const plugin = getDevicePlugin(device);
	if (plugin?.refreshState) {
		await plugin.refreshState(state);
	}
}

/** Forcefully kill any processes/containers holding `device`. */
export async function killDeviceHolders(device: HardwareDevice): Promise<void> {
	const plugin = getDevicePlugin(device);
	if (!plugin) return;
	await plugin.killHolders();
}
