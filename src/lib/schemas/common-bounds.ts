import { z } from 'zod';

/**
 * Shared physical bounds for RF / geospatial / hardware schemas.
 *
 * Bounds are intentionally wider than typical operating ranges to avoid
 * rejecting legitimate edge cases (e.g. balloon-borne sensors at 50 km,
 * underwater RF) while still catching spoofed or garbage-valued input.
 *
 * Extracted from dragonsync.ts (BUG-2 hardening, PR #245) so api.ts,
 * kismet.ts, and hardware.ts can reuse the same definitions.
 */

/** Latitude in degrees: WGS84 valid range. */
export const LatBounds = z.number().min(-90).max(90);

/** Longitude in degrees: WGS84 valid range. */
export const LonBounds = z.number().min(-180).max(180);

/** Altitude in meters above mean sea level: covers Dead Sea (-430m) to balloon altitudes. */
export const AltMetersBounds = z.number().min(-500).max(50_000);

/** RSSI in dBm: positive dBm is unphysical for received signals; -150 is well below thermal noise floor. */
export const RssiDbmBounds = z.number().min(-150).max(0);

/**
 * Frequency in MHz: HackRF 1 MHz – 6 GHz, B205mini 70 MHz – 6 GHz.
 * Upper limit is the wider envelope; per-device gating lives in spectrum.ts
 * (common-bounds owns universal physical constants only, not device caps).
 */
export const FreqMhzBounds = z.number().min(1).max(6000);

/**
 * Signal bandwidth in Hz: HackRF max 20 MHz, B205mini max 61.44 MHz.
 * Upper bound 100 MHz leaves headroom for future wideband SDRs (USRP X310 =
 * 160 MHz) while rejecting obviously corrupt values.
 */
export const BandwidthHzBounds = z.number().positive().max(100_000_000);
