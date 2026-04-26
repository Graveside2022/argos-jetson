/**
 * Spec-024 PR9a — SpectrumSource factory.
 *
 * Single point of dispatch from `HardwareDevice` enum to a concrete
 * `SpectrumSource` implementation. Adding a new SDR is one case clause.
 *
 * Future-proofing: when we have 5+ implementations, swap to a registry
 * map (`Map<HardwareDevice, () => SpectrumSource>`) — same caller API,
 * different internals. Or pivot to `SoapySpectrumSource` once SoapySDR
 * carries the cost of universality (https://github.com/pothosware/SoapySDR).
 *
 * @module
 */

import { HardwareDevice } from '$lib/server/hardware/types';

import { HackRFSpectrumSource } from './hackrf-source';
import type { SpectrumSource } from './types';

/**
 * Construct a fresh `SpectrumSource` for the given device. Caller owns
 * the returned instance — must call `.stop()` to release hardware locks
 * and detach event listeners before discarding.
 *
 * Throws `Error` for unsupported devices. PR9a registers HACKRF only;
 * PR9b adds B205 by extending the switch.
 */
export function createSpectrumSource(device: HardwareDevice): SpectrumSource {
	switch (device) {
		case HardwareDevice.HACKRF:
			return new HackRFSpectrumSource();
		case HardwareDevice.B205:
			throw new Error(
				'B205SpectrumSource lands in spec-024 PR9b — see plan + tasks.md T050'
			);
		default:
			throw new Error(`No SpectrumSource registered for device: ${device}`);
	}
}

/**
 * Resolve a request's optional `device` field (per `DeviceTypeSchema` =
 * `'hackrf' | 'b205' | 'auto'`) to a concrete `HardwareDevice` enum
 * value. `'auto'` picks the first wired SDR; PR9a has only HackRF.
 */
export function resolveDeviceType(deviceType: string | undefined): HardwareDevice {
	if (deviceType === 'b205') return HardwareDevice.B205;
	if (deviceType === 'hackrf' || deviceType === 'auto' || deviceType === undefined) {
		return HardwareDevice.HACKRF;
	}
	throw new Error(`Unknown deviceType: ${deviceType}`);
}
