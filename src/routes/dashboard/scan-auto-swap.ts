/**
 * UAS scan auto-swap state machine. Extracted from +page.svelte.
 *
 * When a scan starts (status starting|running), swap the center region to the
 * UAS live-log view; when it stops, revert to whichever non-scan view was last
 * active (default 'map'). Also tracks lastNonScanView so manual navigation
 * during a scan is preserved.
 *
 * Factory closes over `lastSeen` (the machine's only mutable state). +page wires
 * a one-line `$effect(() => scanSwap.reconcile($uasStore.status, $activeView))`
 * — the reactive read stays in the component; the transition logic lives here.
 */
import { get } from 'svelte/store';

import { activeView, lastNonScanView } from '$lib/stores/dashboard/dashboard-store';
import type { ActiveView } from '$lib/types/dashboard-view';

const ACTIVATING_STATUSES = new Set(['starting', 'running']);

export function createScanAutoSwap() {
	let lastSeen: string | null = null;

	function deactivationTarget(): ActiveView {
		const prev = get(lastNonScanView);
		return prev === 'uas-scan' ? 'map' : prev;
	}

	const shouldActivate = (status: string, view: ActiveView) =>
		ACTIVATING_STATUSES.has(status) && view !== 'uas-scan';

	const shouldDeactivate = (status: string, view: ActiveView) =>
		status === 'stopped' && lastSeen !== null && view === 'uas-scan';

	function applyTransition(status: string, view: ActiveView): void {
		if (shouldActivate(status, view)) {
			activeView.set('uas-scan');
			return;
		}
		if (shouldDeactivate(status, view)) {
			activeView.set(deactivationTarget());
		}
	}

	return {
		reconcile(status: string, view: ActiveView): void {
			if (view !== 'uas-scan') lastNonScanView.set(view);
			if (lastSeen === status) return;
			applyTransition(status, view);
			lastSeen = status;
		}
	};
}
