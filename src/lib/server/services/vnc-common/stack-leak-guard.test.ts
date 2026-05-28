import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	execFileAsync: vi.fn(),
	killOrphansByPort: vi.fn(),
	delay: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('$lib/server/exec', () => ({ execFileAsync: mocks.execFileAsync }));
vi.mock('$lib/utils/logger', () => ({ logger: mocks.logger }));
vi.mock('$lib/utils/delay', () => ({ delay: mocks.delay }));
vi.mock('./spawn-helpers', () => ({ killOrphansByPort: mocks.killOrphansByPort }));

import { reapPriorVncStack } from './stack-leak-guard';

describe('reapPriorVncStack', () => {
	const realProcessKill = process.kill;

	beforeEach(() => {
		mocks.execFileAsync.mockReset();
		mocks.killOrphansByPort.mockReset();
		mocks.killOrphansByPort.mockResolvedValue(undefined);
		mocks.delay.mockReset();
		mocks.delay.mockResolvedValue(undefined);
		mocks.logger.info.mockReset();
		mocks.logger.warn.mockReset();
	});

	afterEach(() => {
		process.kill = realProcessKill;
	});

	it('reaps TCP ports for the canonical slot of the tool', async () => {
		mocks.execFileAsync.mockResolvedValue({ stdout: '' });
		await reapPriorVncStack('gnss-sdr-vnc');
		// gnss-sdr-vnc is :98 / 5998 / 6083 per port-allocation.ts
		expect(mocks.killOrphansByPort).toHaveBeenCalledWith(5998, 6083);
	});

	it('SIGTERMs display-argv pids that are alive', async () => {
		mocks.execFileAsync.mockResolvedValue({
			stdout: '12345 /usr/bin/openbox --sm-disable --config-file /tmp/rc.xml\n67890 /usr/bin/Xtigervnc :98 -geometry 1920x1080\n'
		});
		const signals: Array<{ pid: number; sig: NodeJS.Signals | number }> = [];
		process.kill = ((pid: number, sig?: NodeJS.Signals | number) => {
			// Signal 0 = liveness check. Alive pids return; SIGKILL after grace
			// reports dead (signal 0 throws).
			if (sig === 0) {
				// First alive-check returns true; subsequent (post-SIGTERM) throws.
				const priorSigterms = signals.filter(
					(s) => s.pid === pid && s.sig === 'SIGTERM'
				).length;
				if (priorSigterms > 0) throw new Error('ESRCH');
				return true;
			}
			signals.push({ pid, sig: sig as NodeJS.Signals });
			return true;
		}) as typeof process.kill;
		const reaped = await reapPriorVncStack('gnss-sdr-vnc');
		expect(reaped).toBe(2);
		const sigterms = signals.filter((s) => s.sig === 'SIGTERM').map((s) => s.pid);
		expect(sigterms).toEqual([12345, 67890]);
	});

	it('escalates to SIGKILL when pid survives SIGTERM grace window', async () => {
		mocks.execFileAsync.mockResolvedValue({
			stdout: '99999 /usr/bin/Xtigervnc :99 -rfbport 5999\n'
		});
		const signals: Array<{ pid: number; sig: NodeJS.Signals | number }> = [];
		process.kill = ((_pid: number, sig?: NodeJS.Signals | number) => {
			// Signal 0 always reports alive (process ignores SIGTERM).
			if (sig === 0) return true;
			signals.push({ pid: _pid, sig: sig as NodeJS.Signals });
			return true;
		}) as typeof process.kill;
		await reapPriorVncStack('gnu-radio-vnc');
		const seenSignals = signals.map((s) => s.sig);
		expect(seenSignals).toContain('SIGTERM');
		expect(seenSignals).toContain('SIGKILL');
		expect(mocks.logger.warn).toHaveBeenCalledWith(
			expect.stringContaining('SIGTERM ignored, escalating to SIGKILL'),
			expect.objectContaining({ pid: 99999 })
		);
	});

	it('is idempotent — pgrep returning empty gives 0 reaped', async () => {
		mocks.execFileAsync.mockRejectedValue(new Error('pgrep: no matches'));
		const reaped = await reapPriorVncStack('gnu-radio-vnc');
		expect(reaped).toBe(0);
		expect(mocks.killOrphansByPort).toHaveBeenCalledWith(5999, 6084);
	});

	it('skips already-dead pids (signal 0 throws)', async () => {
		mocks.execFileAsync.mockResolvedValue({
			stdout: '11111 /usr/bin/openbox\n'
		});
		process.kill = ((_pid: number, sig?: NodeJS.Signals | number) => {
			if (sig === 0) throw new Error('ESRCH');
			throw new Error('should not be called when dead');
		}) as typeof process.kill;
		const reaped = await reapPriorVncStack('sdrpp');
		expect(reaped).toBe(0);
	});

	it('logs only when reaped > 0', async () => {
		mocks.execFileAsync.mockResolvedValue({ stdout: '' });
		await reapPriorVncStack('sparrow');
		expect(mocks.logger.info).not.toHaveBeenCalled();
	});

	it('pgrep argv uses word-boundary anchored display pattern', async () => {
		mocks.execFileAsync.mockResolvedValue({ stdout: '' });
		await reapPriorVncStack('gnss-sdr-vnc');
		expect(mocks.execFileAsync).toHaveBeenCalledWith('/usr/bin/pgrep', [
			'-af',
			'(^|\\s):98(\\s|$)'
		]);
	});
});
