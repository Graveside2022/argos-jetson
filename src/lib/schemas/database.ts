/**
 * Database Zod Schemas for Runtime Validation
 * Created for: Constitutional Audit Remediation (P1)
 * Tasks: T034-T036
 *
 * Purpose: Validate data returned from SQLite queries to ensure data integrity
 * - DbSignal: Signal records from rf_signals.db
 * - DbNetwork: Network records from rf_signals.db
 * - DbDevice: Device records from rf_signals.db
 *
 * Usage: Use safeParse() with handleValidationError() for all database query results
 */

import { z } from 'zod';

import { AltMetersBounds, FreqMhzBounds, RssiDbmBounds } from './common-bounds';

/**
 * DbSignal Schema - Validates signal records from database
 *
 * Validation rules:
 * - id: optional positive integer (auto-increment primary key)
 * - signal_id: non-empty string (unique identifier)
 * - device_id: optional non-empty string
 * - timestamp: positive integer (Unix timestamp in ms)
 * - latitude: -90 to 90 degrees
 * - longitude: -180 to 180 degrees
 * - altitude: optional number (meters)
 * - power: -120 to 0 dBm (realistic signal power range)
 * - frequency: 1 to 6000 MHz (HackRF operating range)
 * - bandwidth: optional positive number or null
 * - modulation: optional non-empty string or null
 * - source: non-empty string (SDR hardware source)
 * - metadata: optional JSON string
 */
export const DbSignalSchema = z.object({
	id: z.number().int().positive().optional(),
	signal_id: z.string().min(1),
	device_id: z.string().min(1).optional(),
	timestamp: z.number().int().positive(),
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	altitude: AltMetersBounds.optional(),
	power: RssiDbmBounds,
	frequency: FreqMhzBounds,
	bandwidth: z.number().positive().nullable().optional(),
	modulation: z.string().min(1).nullable().optional(),
	source: z.string().min(1),
	metadata: z.string().optional(),
	session_id: z.string().min(1).nullable().optional()
});

/**
 * DbDevice Schema - Validates device records from database
 *
 * Validation rules:
 * - id: optional positive integer (auto-increment primary key)
 * - device_id: non-empty string (unique identifier)
 * - type: non-empty string (device type: wifi, bluetooth, rf, etc.)
 * - manufacturer: optional non-empty string
 * - first_seen: positive integer (Unix timestamp in ms)
 * - last_seen: positive integer (Unix timestamp in ms)
 * - avg_power: optional number (average signal power in dBm)
 * - freq_min: optional positive number (minimum frequency in MHz)
 * - freq_max: optional positive number (maximum frequency in MHz)
 * - metadata: optional JSON string
 */
export const DbDeviceSchema = z.object({
	id: z.number().int().positive().optional(),
	device_id: z.string().min(1),
	type: z.string().min(1),
	manufacturer: z.string().min(1).optional(),
	first_seen: z.number().int().positive(),
	last_seen: z.number().int().positive(),
	avg_power: RssiDbmBounds.optional(),
	freq_min: FreqMhzBounds.optional(),
	freq_max: FreqMhzBounds.optional(),
	metadata: z.string().optional()
});
