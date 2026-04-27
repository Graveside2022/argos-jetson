/**
 * Spec-024 PR9b T050 — B205mini SpectrumSource adapter.
 *
 * Wraps a Python sidecar (`scripts/spectrum/b205_spectrum.py`) that owns
 * the UHD `MultiUSRP` lifecycle. Node has no UHD bindings, so we spawn
 * `python3` and parse line-delimited JSON spectrum frames from its
 * stdout — same pattern as the C2 scanner bridge at
 * src/lib/server/services/dragonsync/c2-subscriber.ts:1-18.
 *
 * Authoritative references for the sidecar protocol + UHD knobs:
 *   - https://files.ettus.com/manual/page_usrp_b200.html
 *   - https://files.ettus.com/manual/page_python.html
 *   - https://github.com/EttusResearch/uhd/blob/master/host/examples/python/rx_spectrum_to_asciiplot.py
 *
 * Hardware requirement (deferred install, runtime-only): `python3-uhd` apt
 * package on the Argos host. Tests mock `node:child_process.spawn` so this
 * file builds and tests pass on any machine without UHD.
 *
 * @module
 */

import {
	type ChildProcessByStdio,
	spawn as nativeSpawn,
	type SpawnOptionsWithStdioTuple,
	type StdioNull,
	type StdioPipe
} from 'node:child_process';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import type { Readable } from 'node:stream';

import { HardwareDevice } from '$lib/server/hardware/types';
import { logger } from '$lib/utils/logger';

import type {
	SourceState,
	SourceStatus,
	SpectrumConfig,
	SpectrumFrame,
	SpectrumSource
} from './types';

const HZ_PER_MHZ = 1_000_000;
const B205_MIN_FREQ_HZ = 70 * HZ_PER_MHZ;
const B205_MAX_FREQ_HZ = 6_000 * HZ_PER_MHZ;
const SIGTERM_GRACE_MS = 2_000;
const DEFAULT_SCRIPT_REL = 'scripts/spectrum/b205_spectrum.py';

type B205Child = ChildProcessByStdio<null, Readable, Readable>;

type SpawnImpl = (
	command: string,
	args: readonly string[],
	options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>
) => B205Child;

const defaultSpawn: SpawnImpl = (cmd, args, opts) => nativeSpawn(cmd, args, opts) as B205Child;
let spawnImpl: SpawnImpl = defaultSpawn;

/**
 * @internal Test seam — vi.spyOn cannot redefine ESM namespace exports
 * (https://vitest.dev/guide/browser/#limitations), so unit tests inject a
 * fake via this hook. Pass `null` to restore the real spawn.
 */
export function _setSpawnImplForTest(impl: SpawnImpl | null): void {
	spawnImpl = impl ?? defaultSpawn;
}

/**
 * NDJSON frame shape emitted by `b205_spectrum.py`. Field names match the
 * sidecar — keep in sync.
 */
interface SidecarFrame {
	ts: number;
	startFreq: number;
	endFreq: number;
	power: number[];
}

function hasNumericTriad(o: Record<string, unknown>): boolean {
	return (
		typeof o.ts === 'number' &&
		typeof o.startFreq === 'number' &&
		typeof o.endFreq === 'number'
	);
}

function hasNonEmptyPowerArray(o: Record<string, unknown>): boolean {
	return Array.isArray(o.power) && (o.power as unknown[]).length > 0;
}

function isSidecarFrame(v: unknown): v is SidecarFrame {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return hasNumericTriad(o) && hasNonEmptyPowerArray(o);
}

/**
 * Resolve the sidecar script path. Override via `ARGOS_B205_SCRIPT` for
 * production deployments where the script lives outside the repo.
 */
export function resolveScriptPath(): string {
	return process.env.ARGOS_B205_SCRIPT ?? join(process.cwd(), DEFAULT_SCRIPT_REL);
}

/**
 * Validate a `SpectrumConfig` against B205mini hardware bounds. Pure —
 * exposed for unit testing without a spawn.
 */
export function validateB205Config(config: SpectrumConfig): void {
	if (config.gain.kind !== 'b205') {
		throw new Error(
			`B205SpectrumSource requires gain.kind='b205', got '${config.gain.kind}'`
		);
	}
	if (config.startFreq < B205_MIN_FREQ_HZ) {
		throw new Error(
			`B205 startFreq below 70 MHz lower edge: ${config.startFreq} Hz`
		);
	}
	if (config.endFreq > B205_MAX_FREQ_HZ) {
		throw new Error(`B205 endFreq above 6 GHz upper edge: ${config.endFreq} Hz`);
	}
	if (config.endFreq <= config.startFreq) {
		throw new Error('endFreq must exceed startFreq');
	}
}

/**
 * Translate `SpectrumConfig` into argv for the python sidecar. Pure —
 * exposed for unit testing.
 */
export function buildPythonArgs(config: SpectrumConfig): string[] {
	if (config.gain.kind !== 'b205') {
		throw new Error('buildPythonArgs requires gain.kind=b205');
	}
	const center = (config.startFreq + config.endFreq) / 2;
	const span = config.endFreq - config.startFreq;
	const sampleRate = config.sampleRate ?? config.gain.bandwidth ?? span;
	return [
		'--center',
		String(center),
		'--rate',
		String(sampleRate),
		'--gain',
		String(config.gain.rxGain),
		'--bin-width',
		String(config.binWidth)
	];
}

export class B205SpectrumSource extends EventEmitter implements SpectrumSource {
	readonly device = HardwareDevice.B205;

	private state: SourceState = 'idle';
	private currentConfig: SpectrumConfig | undefined;
	private lastFrameAt: number | undefined;
	private lastError: string | undefined;
	private child: B205Child | null = null;
	private reader: Interface | null = null;

	async start(config: SpectrumConfig): Promise<void> {
		if (this.state === 'streaming' || this.state === 'starting') {
			throw new Error('B205SpectrumSource: already streaming — call stop() first');
		}
		validateB205Config(config);

		this.currentConfig = config;
		this.lastError = undefined;
		this.transitionState('starting');

		const argv = [resolveScriptPath(), ...buildPythonArgs(config)];

		let child: B205Child;
		try {
			child = spawnImpl('/usr/bin/python3', argv, {
				stdio: ['ignore', 'pipe', 'pipe']
			});
		} catch (err) {
			this.lastError = err instanceof Error ? err.message : String(err);
			this.transitionState('error');
			throw err;
		}

		this.child = child;
		this.attachChildHandlers(child);
		this.transitionState('streaming');
	}

	async stop(): Promise<void> {
		if (this.state === 'idle' || this.state === 'stopping') return;
		this.transitionState('stopping');

		const child = this.child;
		if (!child) {
			this.transitionState('idle');
			return;
		}

		await new Promise<void>((resolve) => {
			const killTimer = setTimeout(() => {
				try {
					child.kill('SIGKILL');
				} catch {
					// Already dead — exit handler will resolve.
				}
			}, SIGTERM_GRACE_MS);

			child.once('exit', () => {
				clearTimeout(killTimer);
				resolve();
			});

			try {
				child.kill('SIGTERM');
			} catch {
				clearTimeout(killTimer);
				resolve();
			}
		});

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

	private attachChildHandlers(child: B205Child): void {
		child.on('error', (err) => {
			this.lastError = err.message;
			logger.error('[b205-source] child error', { msg: err.message });
			this.emit('error', err);
		});

		child.on('exit', (code, signalName) => {
			logger.debug('[b205-source] child exit', { code, signal: signalName });
			this.child = null;
			this.reader = null;
			if (this.state === 'streaming' || this.state === 'starting') {
				this.lastError = `child exited unexpectedly code=${code} signal=${signalName}`;
				this.transitionState('error');
				this.emit('error', new Error(this.lastError));
			}
		});

		child.stderr.on('data', (chunk: Buffer) => {
			const msg = chunk.toString().trim();
			if (msg) logger.error('[b205-source] stderr', { msg });
		});

		this.reader = createInterface({ input: child.stdout });
		this.reader.on('line', (raw) => this.handleLine(raw));
	}

	private handleLine(raw: string): void {
		if (!raw.trim()) return;
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return;
		}
		if (!isSidecarFrame(parsed)) return;

		const frame: SpectrumFrame = {
			device: this.device,
			startFreq: parsed.startFreq,
			endFreq: parsed.endFreq,
			binWidth: (parsed.endFreq - parsed.startFreq) / parsed.power.length,
			power: parsed.power,
			timestamp: parsed.ts
		};
		this.lastFrameAt = frame.timestamp;
		this.emit('frame', frame);
	}

	private transitionState(next: SourceState): void {
		this.state = next;
		this.emit('status', this.getStatus());
	}
}
