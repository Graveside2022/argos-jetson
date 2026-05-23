/**
 * RF Propagation parameter store — persisted user settings for CloudRF computations.
 *
 * Stores the user's preferred frequency, antenna heights, polarization,
 * colormap, radius, resolution, and computation mode. Persists to localStorage.
 *
 * Phase 3 / ADR-0003: migrated from `svelte/store` (`persistedWritable` +
 * `writable` + `derived`) to the rune state layer. `rfParams` uses
 * `persistedState`; compute state is module `$state` exposed via getter
 * accessors.
 *
 * @module
 */

import { persistedState } from '$lib/state/persisted.svelte';
import type {
	CloudRFColormapName,
	ClutterProfile,
	PropagationMode,
	PropagationModelId,
	ReliabilityPercent
} from '$lib/types/rf-propagation';

// ── Persisted parameters ────────────────────────────────────────────

export interface RFPropagationParams {
	mode: PropagationMode;
	frequency: number;
	polarization: number;
	txHeight: number;
	rxHeight: number;
	radius: number;
	resolution: number;
	colormap: CloudRFColormapName;
	txPower: number;
	rxSensitivity: number;
	clutterProfile: ClutterProfile;
	propagationModel: PropagationModelId | null;
	reliability: ReliabilityPercent;
}

const DEFAULT_PARAMS: RFPropagationParams = {
	mode: 'coverage',
	frequency: 500,
	polarization: 1,
	txHeight: 5,
	rxHeight: 2,
	radius: 5,
	resolution: 10,
	colormap: 'RAINBOW45.dBm',
	txPower: 5,
	rxSensitivity: -90,
	clutterProfile: 'Minimal.clt',
	propagationModel: null,
	reliability: 95
};

export const rfParams = persistedState<RFPropagationParams>('rfPropagationParams', DEFAULT_PARAMS, {
	validate: (stored) => ({ ...DEFAULT_PARAMS, ...stored })
});

/** Update a single parameter. */
export function updateRFParam<K extends keyof RFPropagationParams>(
	key: K,
	value: RFPropagationParams[K]
): void {
	rfParams.set({ ...rfParams.current, [key]: value });
}

// ── Computation state (in-memory) ───────────────────────────────────

type ComputeState = 'idle' | 'computing' | 'error' | 'done';

let state = $state<ComputeState>('idle');
let error = $state<string | null>(null);
let progress = $state<string>('');

export const computeState = {
	get current() {
		return state;
	}
};
export const computeError = {
	get current() {
		return error;
	}
};
export const computeProgress = {
	get current() {
		return progress;
	}
};
export const isComputing = {
	get current() {
		return state === 'computing';
	}
};

/** Mark computation as in-progress. */
export function startCompute(message: string): void {
	state = 'computing';
	error = null;
	progress = message;
}

/** Mark computation as completed. */
export function completeCompute(): void {
	state = 'done';
	progress = '';
}

/** Mark computation as failed. */
export function failCompute(message: string): void {
	state = 'error';
	error = message;
	progress = '';
}

/** Reset to idle state. */
export function resetCompute(): void {
	state = 'idle';
	error = null;
	progress = '';
}
