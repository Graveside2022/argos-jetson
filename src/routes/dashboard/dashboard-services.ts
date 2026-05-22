/**
 * Dashboard background-service lifecycle. Extracted from +page.svelte so the
 * page orchestrator no longer owns GPS/Kismet/TAK construction + start/stop.
 *
 * Plain factory (no runes needed). The three tactical-map service classes are
 * DYNAMICALLY imported inside start() (which +page calls in onMount, post-paint)
 * so their heavy transitive graph — zod schemas, mgrs, country-detector,
 * status-bar-data — is code-split OUT of the eager dashboard chunk and never
 * evaluated on the first-paint critical path. Type-only imports below are
 * erased at build, so they pull nothing into the chunk.
 */
import { startGpPolling, stopGpPolling } from '$lib/stores/globalprotect-store';
import type { GPSService } from '$lib/tactical-map/gps-service';
import type { KismetService } from '$lib/tactical-map/kismet-service';
import type { TakService } from '$lib/tactical-map/tak-service';
import { logger } from '$lib/utils/logger';

export function createDashboardServices() {
	let gps: GPSService | null = null;
	let kismet: KismetService | null = null;
	let tak: TakService | null = null;

	return {
		async start(): Promise<void> {
			const [{ GPSService }, { KismetService }, { TakService }] = await Promise.all([
				import('$lib/tactical-map/gps-service'),
				import('$lib/tactical-map/kismet-service'),
				import('$lib/tactical-map/tak-service')
			]);
			const gpsSvc = (gps = new GPSService());
			const kismetSvc = (kismet = new KismetService());
			const takSvc = (tak = new TakService());

			// Each kickoff is isolated: one service failing to start must not skip
			// the others (e.g. Kismet down should not block GPS/TAK).
			const kickoffs: [string, () => void][] = [
				['gps.startPositionUpdates', () => gpsSvc.startPositionUpdates()],
				['kismet.startPeriodicStatusCheck', () => kismetSvc.startPeriodicStatusCheck()],
				['kismet.startPeriodicDeviceFetch', () => kismetSvc.startPeriodicDeviceFetch()],
				['tak.startPeriodicStatusCheck', () => takSvc.startPeriodicStatusCheck()],
				['globalprotect.startGpPolling', () => startGpPolling()]
			];
			for (const [label, run] of kickoffs) {
				try {
					run();
				} catch (error) {
					logger.error(`dashboard service kickoff failed: ${label}`, { error });
				}
			}
			void kismetSvc
				.fetchKismetDevices()
				.catch((error) => logger.warn('initial Kismet device fetch failed', { error }));
		},
		stop(): void {
			// May run before start()'s dynamic import resolves — guard each ref.
			gps?.stopPositionUpdates();
			kismet?.stopPeriodicChecks();
			tak?.stopPeriodicChecks();
			stopGpPolling();
		}
	};
}
