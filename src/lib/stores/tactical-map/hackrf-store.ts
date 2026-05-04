import { type Writable, writable } from 'svelte/store';

import { SimplifiedSignalSchema } from '$lib/schemas/stores';
import type { LeafletMarker } from '$lib/types/map';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

export interface SimplifiedSignal {
	id: string;
	frequency: number;
	power: number;
	lat: number;
	lon: number;
	timestamp: number;
	count: number;
}

export interface HackRFState {
	isSearching: boolean;
	connectionStatus: 'Connected' | 'Disconnected';
	/** Active frequency in MHz. SSE data arrives in Hz and is converted by HackRFDataService. */
	targetFrequency: number;
	signalCount: number;
	currentSignal: SimplifiedSignal | null;
	signals: Map<string, SimplifiedSignal>;
	signalMarkers: Map<string, LeafletMarker>;
}

const initialHackRFState: HackRFState = {
	isSearching: false,
	connectionStatus: 'Disconnected',
	targetFrequency: 2437, // Default WiFi channel 6
	signalCount: 0,
	currentSignal: null,
	signals: new Map(),
	signalMarkers: new Map()
};

export const hackrfStore: Writable<HackRFState> = writable(initialHackRFState);

// Helper functions to update store
export const setConnectionStatus = (status: 'Connected' | 'Disconnected') => {
	hackrfStore.update((state) => ({ ...state, connectionStatus: status }));
};

export const setTargetFrequency = (frequency: number) => {
	hackrfStore.update((state) => ({ ...state, targetFrequency: frequency }));
};

export const updateSignal = (signalId: string, updates: Partial<SimplifiedSignal>) => {
	// Validate updated signal data before applying (T040)
	hackrfStore.update((state) => {
		const newSignals = new Map(state.signals);
		const existingSignal = newSignals.get(signalId);
		if (existingSignal) {
			const mergedSignal = { ...existingSignal, ...updates };
			const validated = safeParseWithHandling(
				SimplifiedSignalSchema,
				mergedSignal,
				'background'
			);
			if (!validated) {
				logger.error(
					'Invalid signal update data',
					{ signalId, updates },
					'signal-update-validation-failed'
				);
				return state; // Return unchanged state if validation fails
			}
			newSignals.set(signalId, validated);
		}
		return { ...state, signals: newSignals };
	});
};
