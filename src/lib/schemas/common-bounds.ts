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
