/**
 * Blue Dragon CLI argument builder. Pure — no process state — so it's
 * directly testable (`process-manager.test.ts`).
 *
 * @module
 */

import { env } from '$lib/server/env';
import type { BluedragonOptions, BluedragonProfile } from '$lib/types/bluedragon';

const BD_PCAP_PATH = env.BD_PCAP_PATH;
const BD_INTERFACE = env.BD_INTERFACE;

interface ProfileArgs {
	gain: number;
	channels: number;
	squelch: number;
	centerMhz: number;
	antenna: string;
}

const PROFILES: Record<BluedragonProfile, ProfileArgs> = {
	clean: { gain: 40, channels: 40, squelch: -55, centerMhz: 2426, antenna: 'TX/RX' },
	volume: { gain: 50, channels: 40, squelch: -55, centerMhz: 2426, antenna: 'TX/RX' },
	max: { gain: 55, channels: 40, squelch: -55, centerMhz: 2426, antenna: 'TX/RX' }
};

const OPTION_FLAGS = [
	['activeScan', '--active-scan'],
	['gpsd', '--gpsd'],
	['codedScan', '--coded-scan']
] as const satisfies ReadonlyArray<readonly [keyof BluedragonOptions, string]>;

function captureRangeArgs(p: ProfileArgs, allChannels: boolean): string[] {
	if (allChannels) return ['--all-channels'];
	return ['-c', String(p.centerMhz), '-C', String(p.channels)];
}

function optionFlagArgs(options: BluedragonOptions): string[] {
	return OPTION_FLAGS.filter(([key]) => options[key] === true).map(([, flag]) => flag);
}

/** Human-readable summary of opted-in flags — used for start-up logging. */
export function activeFlagSummary(options: BluedragonOptions): string[] {
	const flags = optionFlagArgs(options);
	if (options.allChannels === true) flags.unshift('--all-channels');
	return flags;
}

export function buildArgs(profile: BluedragonProfile, options: BluedragonOptions = {}): string[] {
	const p = PROFILES[profile];
	return [
		'--live',
		'--interface',
		BD_INTERFACE,
		'-g',
		String(p.gain),
		'--antenna',
		p.antenna,
		`--squelch=${p.squelch}`,
		'--check-crc',
		'-w',
		BD_PCAP_PATH,
		...captureRangeArgs(p, options.allChannels === true),
		...optionFlagArgs(options)
	];
}
