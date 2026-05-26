/**
 * Kismet API Response Zod Schemas
 * Runtime validation for Kismet API responses to replace unsafe type assertions
 */

import { z } from 'zod';

import { LatBounds, LonBounds, RssiDbmBounds } from './common-bounds';

/**
 * Kismet Status Response Schema
 */
export const KismetStatusResponseSchema = z.object({
	isRunning: z.boolean(),
	uptime: z.number().nonnegative('Uptime must be non-negative'),
	interface: z.string(),
	deviceCount: z.number().int().nonnegative('Device count must be non-negative'),
	metrics: z.object({
		packetsProcessed: z.number().int().nonnegative(),
		devicesDetected: z.number().int().nonnegative(),
		packetsPerSecond: z.number().nonnegative(),
		bytesPerSecond: z.number().nonnegative()
	}),
	channels: z.array(z.string()),
	monitorInterfaces: z.array(z.string()),
	startTime: z.number().positive('Start time must be positive timestamp').optional()
});

/**
 * Kismet Device Schema
 */
export const KismetDeviceSchema = z.object({
	key: z.string().min(1, 'Device key required'),
	macaddr: z.string().min(1, 'MAC address required'),
	type: z.string().optional(),
	firsttime: z.number().positive().optional(),
	lasttime: z.number().positive().optional(),
	signal: z.number().optional(),
	channel: z.string().optional(),
	frequency: z.number().optional(),
	manuf: z.string().optional(),
	commonname: z.string().optional()
});

/**
 * Simplified Kismet Device Schema (from KismetProxy.getDevices())
 * Used by kismet.service.ts transformKismetDevices()
 */
export const SimplifiedKismetDeviceSchema = z.object({
	mac: z.string().min(1),
	lastSeen: z.union([z.string(), z.number()]), // ISO date string or Unix timestamp
	signal: RssiDbmBounds.optional(),
	type: z.string().optional(),
	location: z
		.object({
			lat: LatBounds.optional(),
			lon: LonBounds.optional()
		})
		.optional(),
	manufacturer: z.string().optional(),
	channel: z.union([z.string(), z.number()]).optional(),
	frequency: z.number().optional(),
	packets: z.number().optional(),
	ssid: z.string().optional(),
	name: z.string().optional(),
	encryption: z.array(z.string()).optional(),
	encryptionType: z.array(z.string()).optional()
});

/**
 * Kismet Dot11 WiFi-specific Device Data
 * Nested within raw Kismet device response
 */
const KismetDot11Schema = z.object({
	'dot11.device.last_beaconed_ssid': z.string().optional(),
	'dot11.device.advertised_ssid_map': z
		.object({
			ssid: z.string().optional()
		})
		.optional()
});

/**
 * Kismet Common Location Data
 * Used within kismet.device.base.location field
 */
const KismetLocationSchema = z.object({
	'kismet.common.location.lat': LatBounds.optional(),
	'kismet.common.location.lon': LonBounds.optional()
});

/**
 * Kismet Signal Data
 * Used within kismet.device.base.signal field
 */
const KismetSignalSchema = z.object({
	'kismet.common.signal.last_signal': RssiDbmBounds.optional(),
	'kismet.common.signal.max_signal': RssiDbmBounds.optional()
});

/**
 * Raw Kismet Device Schema (from Kismet REST API /devices/last-time/{wildcard}/devices.json)
 * Used by kismet.service.ts transformRawKismetDevices()
 *
 * Validation rules:
 * - All fields optional (Kismet API may omit fields for certain device types)
 * - Signal can be number or object with nested kismet.common.signal fields
 * - Location nested in kismet.device.base.location with kismet.common.location fields
 */
export const RawKismetDeviceSchema = z.object({
	'kismet.device.base.macaddr': z.string().optional(),
	'kismet.device.base.type': z.string().optional(),
	'kismet.device.base.last_time': z.number().optional(),
	'kismet.device.base.signal': z.union([z.number(), KismetSignalSchema] as const).optional(),
	'kismet.device.base.location': KismetLocationSchema.optional(),
	'kismet.device.base.manuf': z.string().optional(),
	'kismet.device.base.name': z.string().optional(),
	'kismet.device.base.channel': z.union([z.string(), z.number()] as const).optional(),
	'kismet.device.base.frequency': z.number().optional(),
	'kismet.device.base.packets.total': z.number().optional(),
	'dot11.device': KismetDot11Schema.optional()
});

/**
 * Export inferred types for TypeScript
 */
export type SimplifiedKismetDevice = z.infer<typeof SimplifiedKismetDeviceSchema>;
export type RawKismetDevice = z.infer<typeof RawKismetDeviceSchema>;
