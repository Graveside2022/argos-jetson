/**
 * Spec-024 PR9a — module-scope registry of the active SpectrumSource.
 *
 * Argos's hardware model is single-tenant per device — only one
 * `SpectrumSource` should be streaming at a time. The SSE proxy at
 * `/api/spectrum/stream/+server.ts` subscribes to this registry's
 * fan-out events; the start/stop endpoints swap the active source.
 *
 * Pattern matches Argos's existing module-scope singletons (see
 * `sweepManager` at src/lib/server/hackrf/sweep-manager.ts:298).
 *
 * @module
 */

import { EventEmitter } from 'node:events';

import { logger } from '$lib/utils/logger';

import type { SourceStatus, SpectrumFrame, SpectrumSource } from './types';

class SourceRegistry extends EventEmitter {
	private activeSource: SpectrumSource | null = null;

	/**
	 * Set the currently active source. Detaches listeners from any prior
	 * source so events from the old instance don't leak into new
	 * subscribers.
	 */
	setActive(source: SpectrumSource | null): void {
		if (this.activeSource && this.activeSource !== source) {
			this.activeSource.removeAllListeners();
		}

		this.activeSource = source;

		if (source) {
			source.on('frame', this.relayFrame);
			source.on('status', this.relayStatus);
			source.on('error', this.relayError);
		}
	}

	getActive(): SpectrumSource | null {
		return this.activeSource;
	}

	/** Stop the active source and clear the registry. */
	async clear(): Promise<void> {
		const current = this.activeSource;
		if (!current) return;

		try {
			await current.stop();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.warn('[source-registry] active source stop() raised', { msg });
		}

		current.removeAllListeners();
		this.activeSource = null;
	}

	private relayFrame = (frame: SpectrumFrame): void => {
		this.emit('frame', frame);
	};

	private relayStatus = (status: SourceStatus): void => {
		this.emit('status', status);
	};

	private relayError = (err: Error): void => {
		this.emit('error', err);
	};
}

export const sourceRegistry = new SourceRegistry();
