import {
	globalHardwareMonitor,
	scanAllHardware
} from '$lib/server/hardware/detection/hardware-detector';
import { safe } from '$lib/server/result';
import { GlobalProtectService } from '$lib/server/services/globalprotect/globalprotect-service';
import { TakService } from '$lib/server/tak/tak-service';
import { logger } from '$lib/utils/logger';

const HARDWARE_MONITOR_INTERVAL_MS = 30_000;

async function bootstrapHardware(): Promise<void> {
	const [scan, scanErr] = await safe(() => scanAllHardware());
	if (scan) {
		logger.info('Hardware detection complete', {
			total: scan.stats.total,
			connected: scan.stats.connected,
			sdrs: scan.stats.byCategory.sdr || 0,
			wifi: scan.stats.byCategory.wifi || 0,
			bluetooth: scan.stats.byCategory.bluetooth || 0
		});
	} else {
		logger.error('Failed to scan hardware', { error: scanErr });
	}
	// Start the periodic monitor regardless of initial-scan outcome — a missed
	// boot scan shouldn't strand later detections (e.g. USB hot-plug).
	globalHardwareMonitor.start(HARDWARE_MONITOR_INTERVAL_MS);
	logger.info('Hardware monitoring started');
}

async function bootstrapTak(): Promise<void> {
	const [, err] = await safe(() => TakService.getInstance().initialize());
	if (err) logger.error('Failed to initialize TakService', { error: err });
}

async function bootstrapGlobalProtect(): Promise<void> {
	const [, err] = await safe(() => GlobalProtectService.getInstance().initialize());
	if (err) logger.error('Failed to initialize GlobalProtectService', { error: err });
}

export async function initServerProcesses(building: boolean): Promise<void> {
	if (building) {
		logger.info('Server-process bootstrap skipped (vite build pass)');
		return;
	}
	await bootstrapHardware();
	await bootstrapTak();
	await bootstrapGlobalProtect();
}
