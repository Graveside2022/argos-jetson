/**
 * Startup orphan scan. Iterates `DEVICE_PLUGINS` and delegates per-device
 * scan logic to each plugin's `scanOrphans` hook. No device-specific
 * branching lives here — adding a new SDR adds a plugin entry only.
 *
 * @module
 */

import { logger } from '$lib/utils/logger';

import { getAllDevicePlugins } from './device-plugins';
import { HardwareDevice, type ResourceState } from './types';

/**
 * Scan for orphan processes/containers/services that may own each
 * registered hardware device. Updates the provided state map with
 * discovered ownership.
 */
export async function scanForOrphans(state: Map<HardwareDevice, ResourceState>): Promise<void> {
	for (const plugin of getAllDevicePlugins()) {
		try {
			if (plugin.scanOrphans) {
				await plugin.scanOrphans(state);
			}
		} catch (error) {
			logger.error('[ResourceManager] Orphan scan failed', {
				device: plugin.id,
				error: String(error)
			});
		}
	}
	logger.info('[ResourceManager] Orphan scan complete');
}
