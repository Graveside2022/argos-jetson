import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HardwareDevice } from '$lib/server/hardware/types';

import {
	_setSpawnImplForTest,
	B205SpectrumSource,
	buildPythonArgs,
	resolveScriptPath,
	validateB205Config
} from './b205-source';
import type { SpectrumConfig, SpectrumFrame } from './types';

class FakeChild extends EventEmitter {
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	killed = false;
	killSignal: string | undefined;
	kill(sig?: string | number): boolean {
		this.killed = true;
		this.killSignal = String(sig ?? 'SIGTERM');
		setImmediate(() => this.emit('exit', null, this.killSignal));
		return true;
	}
}

let spawnCalls: Array<{ cmd: string; args: readonly string[] }> = [];
let lastChild: FakeChild | null = null;

beforeEach(() => {
	spawnCalls = [];
	lastChild = null;
	_setSpawnImplForTest(((cmd: string, args: readonly string[]) => {
		const child = new FakeChild();
		spawnCalls.push({ cmd, args });
		lastChild = child;
		return child;
	}) as never);
});

afterEach(() => {
	_setSpawnImplForTest(null);
});

const baseConfig: SpectrumConfig = {
	startFreq: 880_000_000,
	endFreq: 882_000_000,
	binWidth: 50_000,
	gain: { kind: 'b205', rxGain: 40 }
};

async function flush(): Promise<void> {
	await new Promise((r) => setImmediate(r));
	await new Promise((r) => setImmediate(r));
}

function activeChild(): FakeChild {
	if (!lastChild) throw new Error('no spawn observed yet');
	return lastChild;
}

describe('validateB205Config', () => {
	it('passes for valid B205 config', () => {
		expect(() => validateB205Config(baseConfig)).not.toThrow();
	});

	it('rejects hackrf gain kind', () => {
		expect(() =>
			validateB205Config({
				...baseConfig,
				gain: { kind: 'hackrf', amp: 0, lna: 16, vga: 20 }
			})
		).toThrow(/gain\.kind='b205'/);
	});

	it('rejects sub-70 MHz start freq', () => {
		expect(() => validateB205Config({ ...baseConfig, startFreq: 50_000_000 })).toThrow(
			/below 70 MHz/
		);
	});

	it('rejects above-6 GHz end freq', () => {
		expect(() => validateB205Config({ ...baseConfig, endFreq: 7_000_000_000 })).toThrow(
			/above 6 GHz/
		);
	});

	it('rejects inverted range', () => {
		expect(() =>
			validateB205Config({ ...baseConfig, startFreq: 900_000_000, endFreq: 880_000_000 })
		).toThrow(/endFreq must exceed/);
	});
});

describe('buildPythonArgs', () => {
	it('emits center / rate / gain / bin-width', () => {
		const args = buildPythonArgs(baseConfig);
		expect(args).toContain('--center');
		expect(args).toContain('881000000');
		expect(args).toContain('--rate');
		expect(args).toContain('2000000');
		expect(args).toContain('--gain');
		expect(args).toContain('40');
		expect(args).toContain('--bin-width');
		expect(args).toContain('50000');
	});

	it('honors explicit sampleRate over span', () => {
		const args = buildPythonArgs({ ...baseConfig, sampleRate: 4_000_000 });
		const i = args.indexOf('--rate');
		expect(args[i + 1]).toBe('4000000');
	});

	it('honors gain.bandwidth as fallback sample rate', () => {
		const args = buildPythonArgs({
			...baseConfig,
			gain: { kind: 'b205', rxGain: 30, bandwidth: 3_000_000 }
		});
		const i = args.indexOf('--rate');
		expect(args[i + 1]).toBe('3000000');
	});

	it('rejects non-b205 gain', () => {
		expect(() =>
			buildPythonArgs({
				...baseConfig,
				gain: { kind: 'hackrf', amp: 0, lna: 16, vga: 20 }
			})
		).toThrow(/gain\.kind=b205/);
	});
});

describe('resolveScriptPath', () => {
	it('respects ARGOS_B205_SCRIPT env override', () => {
		const prev = process.env.ARGOS_B205_SCRIPT;
		process.env.ARGOS_B205_SCRIPT = '/opt/custom/path.py';
		try {
			expect(resolveScriptPath()).toBe('/opt/custom/path.py');
		} finally {
			if (prev === undefined) delete process.env.ARGOS_B205_SCRIPT;
			else process.env.ARGOS_B205_SCRIPT = prev;
		}
	});

	it('falls back to project-relative default', () => {
		const prev = process.env.ARGOS_B205_SCRIPT;
		delete process.env.ARGOS_B205_SCRIPT;
		try {
			expect(resolveScriptPath()).toMatch(/scripts\/spectrum\/b205_spectrum\.py$/);
		} finally {
			if (prev !== undefined) process.env.ARGOS_B205_SCRIPT = prev;
		}
	});
});

describe('B205SpectrumSource', () => {
	it('exposes B205 as device', () => {
		expect(new B205SpectrumSource().device).toBe(HardwareDevice.B205);
	});

	it('start() spawns python3 with the sidecar script + config args', async () => {
		const src = new B205SpectrumSource();
		await src.start(baseConfig);

		expect(spawnCalls).toHaveLength(1);
		const [{ cmd, args }] = spawnCalls;
		expect(cmd).toBe('/usr/bin/python3');
		expect(args[0]).toMatch(/b205_spectrum\.py$/);
		expect(args).toContain('--center');
		expect(args).toContain('881000000');
		expect(src.getStatus().state).toBe('streaming');
	});

	it('rejects start() if already streaming', async () => {
		const src = new B205SpectrumSource();
		await src.start(baseConfig);
		await expect(src.start(baseConfig)).rejects.toThrow(/already streaming/);
	});

	it('rejects start() with invalid config (sub-70 MHz)', async () => {
		const src = new B205SpectrumSource();
		await expect(src.start({ ...baseConfig, startFreq: 50_000_000 })).rejects.toThrow(
			/below 70 MHz/
		);
		expect(spawnCalls).toHaveLength(0);
	});

	it('translates NDJSON line on stdout into a SpectrumFrame', async () => {
		const src = new B205SpectrumSource();
		await src.start(baseConfig);

		const received: SpectrumFrame[] = [];
		src.on('frame', (f) => received.push(f));

		activeChild().stdout.write(
			JSON.stringify({
				ts: 1234,
				startFreq: 880_000_000,
				endFreq: 882_000_000,
				power: [-50, -45, -40, -35]
			}) + '\n'
		);
		await flush();

		expect(received).toHaveLength(1);
		const f = received[0];
		expect(f.device).toBe(HardwareDevice.B205);
		expect(f.startFreq).toBe(880_000_000);
		expect(f.endFreq).toBe(882_000_000);
		expect(f.binWidth).toBe(500_000);
		expect(f.power).toEqual([-50, -45, -40, -35]);
		expect(f.timestamp).toBe(1234);
	});

	it('drops malformed JSON without emitting frame', async () => {
		const src = new B205SpectrumSource();
		await src.start(baseConfig);

		const received: SpectrumFrame[] = [];
		src.on('frame', (f) => received.push(f));

		activeChild().stdout.write('not-json\n');
		activeChild().stdout.write(JSON.stringify({ wrong: 'shape' }) + '\n');
		activeChild().stdout.write(
			JSON.stringify({ ts: 1, startFreq: 1, endFreq: 2, power: [] }) + '\n'
		);
		await flush();

		expect(received).toHaveLength(0);
	});

	it('emits status transitions: starting → streaming → stopping → idle', async () => {
		const src = new B205SpectrumSource();
		const states: string[] = [];
		src.on('status', (s) => states.push(s.state));

		await src.start(baseConfig);
		await src.stop();
		await flush();

		expect(states).toEqual(['starting', 'streaming', 'stopping', 'idle']);
	});

	it('stop() sends SIGTERM to the child', async () => {
		const src = new B205SpectrumSource();
		await src.start(baseConfig);
		const child = activeChild();
		await src.stop();
		expect(child.killed).toBe(true);
		expect(child.killSignal).toBe('SIGTERM');
	});

	it('child crash transitions to error and emits error event', async () => {
		const src = new B205SpectrumSource();
		await src.start(baseConfig);

		const errors: Error[] = [];
		src.on('error', (e) => errors.push(e));

		activeChild().emit('exit', 1, null);
		await flush();

		expect(src.getStatus().state).toBe('error');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toMatch(/code=1/);
	});

	it('stop() is a no-op when idle', async () => {
		const src = new B205SpectrumSource();
		await expect(src.stop()).resolves.toBeUndefined();
		expect(spawnCalls).toHaveLength(0);
	});
});
