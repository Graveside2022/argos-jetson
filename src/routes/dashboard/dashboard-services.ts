/**
 * Dashboard background-service lifecycle. Extracted from +page.svelte so the
 * page orchestrator no longer owns GPS/Kismet/TAK construction + start/stop.
 *
 * Plain factory (no runes needed) — constructs the three client tactical-map
 * services once and groups their start/stop. +page.svelte calls start() in
 * onMount (browser only) and stop() in onDestroy.
 */
import { startGpPolling, stopGpPolling } from '$lib/stores/globalprotect-store';
import { GPSService } from '$lib/tactical-map/gps-service';
import { KismetService } from '$lib/tactical-map/kismet-service';
import { TakService } from '$lib/tactical-map/tak-service';
import { logger } from '$lib/utils/logger';

export function createDashboardServices() {
	const gps = new GPSService();
	const kismet = new KismetService();
	const tak = new TakService();

	return {
		start(): void {
			// Each kickoff is isolated: one service failing to start must not skip
			// the others (e.g. Kismet down should not block GPS/TAK).
			const kickoffs: [string, () => void][] = [
				['gps.startPositionUpdates', () => gps.startPositionUpdates()],
				['kismet.startPeriodicStatusCheck', () => kismet.startPeriodicStatusCheck()],
				['kismet.startPeriodicDeviceFetch', () => kismet.startPeriodicDeviceFetch()],
				['tak.startPeriodicStatusCheck', () => tak.startPeriodicStatusCheck()],
				['globalprotect.startGpPolling', () => startGpPolling()]
			];
			for (const [label, run] of kickoffs) {
				try {
					run();
				} catch (error) {
					logger.error(`dashboard service kickoff failed: ${label}`, { error });
				}
			}
			void kismet
				.fetchKismetDevices()
				.catch((error) => logger.warn('initial Kismet device fetch failed', { error }));
		},
		stop(): void {
			gps.stopPositionUpdates();
			kismet.stopPeriodicChecks();
			tak.stopPeriodicChecks();
			stopGpPolling();
		}
	};
}
