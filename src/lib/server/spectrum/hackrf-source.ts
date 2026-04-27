/**
 * Spec-024 PR9a — HackRF SpectrumSource adapter.
 *
 * Thin event-translation layer over Argos's existing `sweepManager`
 * singleton. Subscribes to the `'spectrum_data'` events emitted from
 * src/lib/server/hackrf/sweep-coordinator.ts:200 and re-emits them as
 * `SpectrumFrame` shapes that match the multi-SDR contract.
 *
 * No new hardware control logic lives here — `sweepManager.startCycle`
 * and `sweepManager.stopSweep` already encapsulate process lifecycle,
 * frequency cycling, and resource locks.
 *
 * @module
 */

import { EventEmitter } from 'node:events';

import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import type { SweepArgs } from '$lib/server/hackrf/types';
import { HardwareDevice } from '$lib/server/hardware/types';
import { logger } from '$lib/utils/logger';

import type {
	SourceState,
	SourceStatus,
	SpectrumConfig,
	SpectrumFrame,
	SpectrumSource
} from './types';

/**
 * Shape of the payload emitted by sweep-coordinator.ts:200 — typed
 * locally because `sweepManager` re-exports the raw event without a
 * narrow event-payload contract.
 */
interface SweepDataEvent {
	frequency?: number;
	timestamp?: number;
	data?: {
		powerValues?: number[];
		startFreq?: number;
		endFreq?: number;
		timestamp?: number;
	};
}

interface ValidatedSweepData {
	powerValues: number[];
	startFreq: number;
	endFreq: number;
	timestamp: number;
}

function hasUsablePayload(
	data: SweepDataEvent['data']
): data is NonNullable<SweepDataEvent['data']> {
	if (!data) return false;
	return Boolean(data.powerValues && data.powerValues.length > 0);
}

function hasFreqBounds(data: { startFreq?: number; endFreq?: number }): boolean {
	return data.startFreq !== undefined && data.endFreq !== undefined;
}

function validateSweepEvent(payload: SweepDataEvent): ValidatedSweepData | null {
	const d = payload.data;
	if (!hasUsablePayload(d) || !hasFreqBounds(d)) return null;
	const ts = d.timestamp ?? payload.timestamp ?? Date.now();
	return {
		powerValues: d.powerValues as number[],
		startFreq: d.startFreq as number,
		endFreq: d.endFreq as number,
		timestamp: ts
	};
}

const HZ_PER_MHZ = 1_000_000;
const DEFAULT_CYCLE_TIME_MS = 10_000;

export class HackRFSpectrumSource extends EventEmitter implements SpectrumSource {
	readonly device = HardwareDevice.HACKRF;

	private state: SourceState = 'idle';
	private currentConfig: SpectrumConfig | undefined;
	private lastFrameAt: number | undefined;
	private lastError: string | undefined;
	private readonly onSweepData = (payload: SweepDataEvent): void => {
		this.handleSweepData(payload);
	};

	async start(config: SpectrumConfig): Promise<void> {
		this.currentConfig = config;
		this.lastError = undefined;
		this.transitionState('starting');

		sweepManager.on('spectrum_data', this.onSweepData);
		// Plumb caller-supplied bin width + per-band gains into hackrf_sweep
		// CLI args. Falls through to coordinator defaults for any field
		// SpectrumConfig doesn't supply.
		sweepManager.setSweepArgsOverride(buildSweepArgsOverride(config));

		try {
			const success = await sweepManager.startCycle(
				[{ value: this.computeCenterMHz(config), unit: 'MHz' }],
				DEFAULT_CYCLE_TIME_MS
			);
			if (!success) throw new Error('sweepManager.startCycle returned false');
		} catch (error) {
			sweepManager.off('spectrum_data', this.onSweepData);
			sweepManager.setSweepArgsOverride(null);
			this.lastError = error instanceof Error ? error.message : String(error);
			this.transitionState('error');
			throw error;
		}

		this.transitionState('streaming');
	}

	async stop(): Promise<void> {
		this.transitionState('stopping');
		sweepManager.off('spectrum_data', this.onSweepData);

		try {
			await sweepManager.stopSweep();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.warn('[hackrf-source] stopSweep raised', { msg });
		}

		this.transitionState('idle');
	}

	getStatus(): SourceStatus {
		return {
			device: this.device,
			state: this.state,
			config: this.currentConfig,
			error: this.lastError,
			lastFrameAt: this.lastFrameAt
		};
	}

	private handleSweepData(payload: SweepDataEvent): void {
		const v = validateSweepEvent(payload);
		if (!v) return;
		const frame: SpectrumFrame = {
			device: this.device,
			startFreq: v.startFreq,
			endFreq: v.endFreq,
			binWidth: (v.endFreq - v.startFreq) / v.powerValues.length,
			power: v.powerValues,
			timestamp: v.timestamp
		};
		this.lastFrameAt = frame.timestamp;
		this.emit('frame', frame);
	}

	private computeCenterMHz(config: SpectrumConfig): number {
		return (config.startFreq + config.endFreq) / 2 / HZ_PER_MHZ;
	}

	private transitionState(next: SourceState): void {
		this.state = next;
		this.emit('status', this.getStatus());
	}
}

/**
 * Translate a `SpectrumConfig` into the `Partial<SweepArgs>` shape the
 * coordinator's `sweepArgsFromCenter` accepts. Only fields the caller
 * actually set are forwarded; missing fields fall through to the
 * coordinator's defaults (100 kHz bin width, per-band selectGains).
 */
export function buildSweepArgsOverride(config: SpectrumConfig): Partial<SweepArgs> {
	const out: Partial<SweepArgs> = {
		binWidthHz: config.binWidth
	};
	if (config.gain.kind === 'hackrf') {
		out.lnaGain = String(config.gain.lna);
		out.vgaGain = String(config.gain.vga);
	}
	return out;
}
