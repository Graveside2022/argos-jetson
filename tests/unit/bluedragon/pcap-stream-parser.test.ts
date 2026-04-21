import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { FrameObservation } from '$lib/server/services/bluedragon/device-aggregator';
import { PcapStreamParser } from '$lib/server/services/bluedragon/pcap-stream-parser';

const FIXTURE = 'tests/fixtures/bluedragon/bench-25s.pcap';

/**
 * True when `tshark` is on PATH. PcapStreamParser shells out to tshark to
 * decode the pcap frames; without it the parser emits an ENOENT and the
 * test can't run. CI runners don't have wireshark installed by default;
 * the Jetson does (wireshark-common package). Skip instead of fail so the
 * test still exercises the real pcap path in any dev environment that
 * has the tool, without blocking CI on an environment-dependency.
 */
function hasTshark(): boolean {
	try {
		execFileSync('tshark', ['--version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function runParser(path: string, timeoutMs = 15_000): Promise<FrameObservation[]> {
	return new Promise((resolve, reject) => {
		const frames: FrameObservation[] = [];
		const parser = new PcapStreamParser({
			pcapPath: path,
			onFrame: (f) => frames.push(f),
			onError: (err) => reject(err),
			onExit: () => resolve(frames)
		});
		parser.start();
		setTimeout(() => {
			parser.stop();
			resolve(frames);
		}, timeoutMs);
	});
}

describe('PcapStreamParser', () => {
	it.skipIf(!existsSync(FIXTURE) || !hasTshark())(
		'parses real Blue Dragon fixture PCAP',
		async () => {
			const frames = await runParser(FIXTURE);
			expect(frames.length).toBeGreaterThan(100);

			const bleFrames = frames.filter((f) => !f.bdClassic);
			const classicFrames = frames.filter((f) => f.bdClassic);

			expect(bleFrames.length).toBeGreaterThan(50);
			expect(classicFrames.length).toBeGreaterThan(50);

			const uniqueBleAddrs = new Set(bleFrames.map((f) => f.addr));
			const uniqueClassicLaps = new Set(classicFrames.map((f) => f.addr));

			expect(uniqueBleAddrs.size).toBeGreaterThan(10);
			expect(uniqueClassicLaps.size).toBeGreaterThan(5);

			const withCompanyId = bleFrames.filter((f) => f.manufacturerCompanyId != null);
			expect(withCompanyId.length).toBeGreaterThan(0);

			const apple = bleFrames.filter((f) => f.manufacturerCompanyId === 0x004c);
			expect(apple.length).toBeGreaterThan(10);

			const withName = bleFrames.filter((f) => f.localName);
			expect(withName.length).toBeGreaterThanOrEqual(1);
		},
		20_000
	);
});
