import { z } from 'zod';

import { AltMetersBounds, LatBounds, LonBounds, RssiDbmBounds } from './common-bounds';

// Drone-telemetry-specific bounds (not shared with other schemas).
const HeightMetersBounds = z.number().min(0).max(50_000); // [0, 50km] above ground
const SpeedMsBounds = z.number().min(0).max(300); // [0, 300 m/s] — fast drones ~70 m/s; small aircraft ~300
const VSpeedMsBounds = z.number().min(-200).max(200);
const HeadingDegBounds = z.number().min(0).max(360);
const FreqMhzBounds = z.number().min(1).max(100_000);

const DragonSyncRidSchema = z
	.object({
		make: z.string().nullable(),
		model: z.string().nullable(),
		source: z.string().nullable(),
		lookup_attempted: z.boolean(),
		lookup_success: z.boolean()
	})
	.passthrough();

const DragonSyncDroneSchema = z
	.object({
		id: z.string(),
		id_type: z.string().default(''),
		ua_type: z.number().nullable().default(null),
		ua_type_name: z.string().default('Unknown'),
		operator_id: z.string().default(''),
		operator_id_type: z.string().default(''),
		op_status: z.string().default(''),
		lat: LatBounds.default(0),
		lon: LonBounds.default(0),
		alt: AltMetersBounds.default(0),
		height: HeightMetersBounds.default(0),
		speed: SpeedMsBounds.default(0),
		vspeed: VSpeedMsBounds.default(0),
		direction: HeadingDegBounds.nullable().default(null),
		pressure_altitude: AltMetersBounds.nullable().default(null),
		height_type: z.string().default(''),
		pilot_lat: LatBounds.default(0),
		pilot_lon: LonBounds.default(0),
		home_lat: LatBounds.default(0),
		home_lon: LonBounds.default(0),
		mac: z.string().default(''),
		rssi: RssiDbmBounds.default(0),
		freq: FreqMhzBounds.nullable().default(null),
		transport: z.string().default(''),
		description: z.string().default(''),
		rid: DragonSyncRidSchema.default({
			make: null,
			model: null,
			source: null,
			lookup_attempted: false,
			lookup_success: false
		}),
		last_update_time: z.number().nonnegative().default(0),
		track_type: z.enum(['drone', 'aircraft']).default('drone'),
		caa_id: z.string().default(''),
		horizontal_accuracy: z.string().default(''),
		vertical_accuracy: z.string().default(''),
		speed_accuracy: z.string().default(''),
		observed_at: z.number().nonnegative().nullable().default(null),
		seen_by: z.string().nullable().default(null)
	})
	.passthrough();

export const DragonSyncDronesResponseSchema = z
	.object({
		drones: z.array(DragonSyncDroneSchema)
	})
	.passthrough();

export const DragonSyncStatusResultSchema = z.object({
	success: z.boolean(),
	droneidGoRunning: z.boolean(),
	dragonSyncRunning: z.boolean(),
	fpvScannerRunning: z.boolean().default(false),
	c2ScannerRunning: z.boolean().default(false),
	status: z.enum(['stopped', 'starting', 'running', 'stopping']),
	droneCount: z.number(),
	apiReachable: z.boolean(),
	error: z.string().optional()
});

export const DragonSyncControlSchema = z.object({
	action: z.enum(['start', 'stop']).describe('DragonSync control action')
});

const DragonSyncFpvSignalSchema = z
	.object({
		uid: z.string(),
		signal_type: z.string().default('fpv'),
		source: z.string().default('energy'),
		alert_id: z.string().default(''),
		callsign: z.string().default(''),
		description: z.string().nullable().default(null),
		self_id: z.string().nullable().default(null),
		center_hz: z.number().positive().nullable().default(null),
		bandwidth_hz: z.number().positive().nullable().default(null),
		pal_conf: z.number().min(0).max(1).nullable().default(null),
		ntsc_conf: z.number().min(0).max(1).nullable().default(null),
		rssi: RssiDbmBounds.nullable().default(null),
		sensor_lat: LatBounds.default(0),
		sensor_lon: LonBounds.default(0),
		sensor_alt: AltMetersBounds.default(0),
		lat: LatBounds.default(0),
		lon: LonBounds.default(0),
		alt: AltMetersBounds.default(0),
		radius_m: z.number().positive().default(15),
		seen_by: z.string().nullable().default(null),
		expires_at: z.number().nonnegative().optional(),
		last_update_time: z.number().nonnegative().optional()
	})
	.passthrough();

export const DragonSyncFpvSignalsResponseSchema = z
	.object({
		signals: z.array(DragonSyncFpvSignalSchema)
	})
	.passthrough();
