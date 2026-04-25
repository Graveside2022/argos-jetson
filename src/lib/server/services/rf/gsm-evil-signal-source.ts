/**
 * GSM Evil adapter for the SignalSource registry.
 *
 * Read-only today: reports whether the GSM Evil pipeline processes are up.
 * Event-to-rf_signals.db persistence is a separate follow-up (the GSM
 * observations go through a tshark + grgsm chain that needs its own
 * marker transform).
 */

import type { SignalSourceAdapter } from './signal-sources';

let pollCachedRunning = false;

// The health service does a full process-presence probe — cheap but not
// free. We cache the answer and refresh asynchronously so isRunning() is
// O(1) for UI consumers.
async function refresh(): Promise<void> {
	try {
		const { getGsmEvilHealth } = await import('./gsm-evil-health-probe');
		pollCachedRunning = await getGsmEvilHealth();
	} catch {
		pollCachedRunning = false;
	}
}

let timer: ReturnType<typeof setInterval> | null = null;

export const gsmEvilSignalSource: SignalSourceAdapter = {
	name: 'gsm-evil',
	isRunning: () => pollCachedRunning,
	start: () => {
		if (timer) return Promise.resolve();
		void refresh();
		timer = setInterval(() => void refresh(), 5_000);
		return Promise.resolve();
	},
	stop: () => {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		pollCachedRunning = false;
		return Promise.resolve();
	}
};
