import {
	globalHardwareMonitor,
	scanAllHardware
} from '$lib/server/hardware/detection/hardware-detector';
import { GlobalProtectService } from '$lib/server/services/globalprotect/globalprotect-service';
import { TakService } from '$lib/server/tak/tak-service';
import { logger } from '$lib/utils/logger';

const HARDWARE_MONITOR_INTERVAL_MS = 30_000;

export function initServerProcesses(building: boolean): void {
	if (building) {
		logger.info('Server-process bootstrap skipped (vite build pass)');
		return;
	}

	scanAllHardware()
		.then((result) => {
			logger.info('Hardware detection complete', {
				total: result.stats.total,
				connected: result.stats.connected,
				sdrs: result.stats.byCategory.sdr || 0,
				wifi: result.stats.byCategory.wifi || 0,
				bluetooth: result.stats.byCategory.bluetooth || 0
			});
			globalHardwareMonitor.start(HARDWARE_MONITOR_INTERVAL_MS);
			logger.info('Hardware monitoring started');
		})
		.catch((error) => {
			logger.error('Failed to scan hardware', { error });
		});

	TakService.getInstance()
		.initialize()
		.catch((err) => {
			logger.error('Failed to initialize TakService', { error: err });
		});

	GlobalProtectService.getInstance()
		.initialize()
		.catch((err) => {
			logger.error('Failed to initialize GlobalProtectService', { error: err });
		});
}
