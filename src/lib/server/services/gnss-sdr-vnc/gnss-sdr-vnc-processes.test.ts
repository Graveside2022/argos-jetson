import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '$lib/server/env';

import {
	_resetModuleStateForTest,
	_setSpawnImplForTest,
	isStackAlive,
	spawnGnssSdr,
	spawnGnssSdrMonitor,
	spawnRtknavi,
	spawnSocatNmeaBridge,
	spawnWindowManager
} from './gnss-sdr-vnc-processes';
import { GNSS_SDR_VNC_DISPLAY } from './gnss-sdr-vnc-types';

interface SpawnCall {
	cmd: string;
	args: readonly string[];
	env: NodeJS.ProcessEnv | undefined;
}

let spawnCalls: SpawnCall[] = [];

beforeEach(() => {
	env.ARGOS_VNC_XTIGERVNC_BIN = '/bin/sh';
	env.ARGOS_VNC_WEBSOCKIFY_BIN = '/bin/sh';
	spawnCalls = [];

	_setSpawnImplForTest(((cmd: string, args: readonly string[], opts: unknown) => {
		const spawnOpts = opts as { env?: NodeJS.ProcessEnv } | undefined;
		spawnCalls.push({ cmd, args, env: spawnOpts?.env });
		return {
			pid: Math.floor(Math.random() * 10000) + 1000,
			exitCode: null,
			on: vi.fn(),
			once: vi.fn(),
			kill: vi.fn(),
			unref: vi.fn(),
			stdout: { on: vi.fn() },
			stderr: { on: vi.fn() }
		} as never;
	}) as never);
});

afterEach(() => {
	_resetModuleStateForTest();
	_setSpawnImplForTest(null);
	delete env.ARGOS_VNC_XTIGERVNC_BIN;
	delete env.ARGOS_VNC_WEBSOCKIFY_BIN;
});

describe('spawnGnssSdr', () => {
	it('wraps gnss-sdr through /usr/local/bin/gnss-sdr-harness.sh (telecommand exit-42 respawn)', () => {
		spawnGnssSdr('/var/lib/argos/gnss-sdr/gnss-sdr.conf');
		expect(spawnCalls).toHaveLength(1);
		expect(spawnCalls[0].cmd).toBe('/usr/local/bin/gnss-sdr-harness.sh');
		expect(spawnCalls[0].args).toEqual([
			'/usr/local/bin/gnss-sdr',
			'--config_file',
			'/var/lib/argos/gnss-sdr/gnss-sdr.conf'
		]);
	});

	it('propagates DISPLAY=:98 in the spawn env so Qt diagnostics land in the VNC framebuffer', () => {
		spawnGnssSdr('/tmp/x.conf');
		expect(spawnCalls[0].env?.DISPLAY).toBe(GNSS_SDR_VNC_DISPLAY);
	});

	it('forces LD_PRELOAD of libuhd 4.1.0 so gr-uhd plugin sees ABI-compatible UHD', () => {
		spawnGnssSdr('/tmp/x.conf');
		expect(spawnCalls[0].env?.LD_PRELOAD).toBe('/usr/lib/aarch64-linux-gnu/libuhd.so.4.1.0');
	});
});

describe('spawnRtknavi + spawnGnssSdrMonitor', () => {
	it('invokes /usr/local/bin/rtknavi_qt with DISPLAY=:98', () => {
		spawnRtknavi();
		expect(spawnCalls[0].cmd).toBe('/usr/local/bin/rtknavi_qt');
		expect(spawnCalls[0].env?.DISPLAY).toBe(GNSS_SDR_VNC_DISPLAY);
	});

	it('invokes /usr/local/bin/gnss-sdr-monitor with DISPLAY=:98', () => {
		spawnGnssSdrMonitor();
		expect(spawnCalls[0].cmd).toBe('/usr/local/bin/gnss-sdr-monitor');
		expect(spawnCalls[0].env?.DISPLAY).toBe(GNSS_SDR_VNC_DISPLAY);
	});
});

describe('spawnWindowManager', () => {
	it('invokes /usr/bin/openbox with --sm-disable + rc.xml + DISPLAY=:98', () => {
		spawnWindowManager();
		expect(spawnCalls).toHaveLength(1);
		expect(spawnCalls[0].cmd).toBe('/usr/bin/openbox');
		expect(spawnCalls[0].args[0]).toBe('--sm-disable');
		expect(spawnCalls[0].args[1]).toBe('--config-file');
		expect(spawnCalls[0].args[2]).toMatch(/argos-gnss-sdr-openbox-rc\.xml$/);
		expect(spawnCalls[0].env?.DISPLAY).toBe(GNSS_SDR_VNC_DISPLAY);
	});
});

describe('spawnSocatNmeaBridge', () => {
	it('bridges the NMEA fifo to TCP :50001 in fork mode for gpsd', () => {
		spawnSocatNmeaBridge();
		expect(spawnCalls[0].cmd).toBe('/usr/bin/socat');
		expect(spawnCalls[0].args[0]).toBe('PIPE:/tmp/argos-gnss-sdr.nmea');
		expect(spawnCalls[0].args[1]).toBe('TCP-LISTEN:50001,reuseaddr,fork');
	});
});

describe('isStackAlive', () => {
	it('returns false when no children have been spawned', () => {
		expect(isStackAlive()).toBe(false);
	});

	it('returns false when only some children are spawned (partial stack)', () => {
		spawnGnssSdr('/tmp/x.conf');
		spawnRtknavi();
		// missing rtkplot, Xtigervnc, websockify, socat
		expect(isStackAlive()).toBe(false);
	});
});
