/**
 * Network Device Detector
 * Detects networked SDRs and other network-connected hardware
 */

import { SpanStatusCode, trace } from '@opentelemetry/api';

import { DetectedHardwareSchema } from '$lib/schemas/hardware.js';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import type { DetectedHardware, SDRCapabilities } from '$lib/server/hardware/detection-types';
import { logger } from '$lib/utils/logger';

/**
 * Tracer for network-detector probes. Probes to Kismet/OpenWebRX/HackRF are
 * expected to fail when those services aren't running — that's how we detect
 * absence. We wrap each probe in an explicit span and force status=OK on
 * caught failures so OTel auto-instrumentation doesn't mark the parent trace
 * as errored (BUG-1, docs/bug-hunt-2026-05-26.md). When no OTel SDK is
 * registered (OTEL_ENABLED!=1) this resolves to a no-op tracer.
 */
const tracer = trace.getTracer('argos.network-detector');

/**
 * Core probe primitive. Calls `fetch(url)` inside a span, forces span
 * status=OK on any failure (so the parent trace stays clean), and applies
 * `onOk` to the response on 2xx. Probe failures are expected — that's how
 * we detect absent services.
 */
async function probe<T>(
	spanName: string,
	url: string,
	onOk: (response: Response) => Promise<T>
): Promise<T | null> {
	return tracer.startActiveSpan(spanName, async (span) => {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
			if (!response.ok) {
				span.setStatus({ code: SpanStatusCode.OK });
				return null;
			}
			const result = await onOk(response);
			span.setStatus({ code: SpanStatusCode.OK });
			return result;
		} catch {
			// Probe failures are expected (service may not be running). Mark the
			// span OK so the parent trace isn't flagged as errored.
			span.setStatus({ code: SpanStatusCode.OK });
			return null;
		} finally {
			span.end();
		}
	});
}

/**
 * Probe a service URL and return the parsed JSON body on a 2xx response.
 * Returns `null` on any failure (ECONNREFUSED, non-2xx, JSON parse error,
 * timeout). See {@link probe} for span-status handling.
 */
async function probeJsonService(spanName: string, url: string): Promise<unknown | null> {
	return probe(spanName, url, async (response) => {
		const data: unknown = await response.json();
		return data;
	});
}

/**
 * Probe a service URL with HEAD-like semantics — returns `true` on a 2xx
 * response, `null` otherwise. Use for endpoints that don't return JSON
 * (e.g. OpenWebRX root HTML).
 */
async function probeReachable(spanName: string, url: string): Promise<true | null> {
	return probe(spanName, url, async () => true as const);
}

// ── USRP network detection ──

const USRP_NET_CAPABILITIES: SDRCapabilities = {
	minFrequency: 70_000_000,
	maxFrequency: 6_000_000_000,
	sampleRate: 61_440_000,
	canTransmit: true,
	canReceive: true,
	fullDuplex: true
};

function parseNetworkUSRPLineFields(line: string, device: Partial<DetectedHardware>): void {
	const addrMatch = line.match(/addr:\s*([0-9.]+)/i);
	const serialMatch = line.match(/serial:\s*([A-F0-9]+)/i);
	const typeMatch = line.match(/type:\s*([^\n,]+)/i);
	const nameMatch = line.match(/name:\s*([^\n,]+)/i);

	if (addrMatch) device.ipAddress = addrMatch[1];
	if (serialMatch) device.serial = serialMatch[1];
	if (typeMatch) device.model = typeMatch[1];
	if (nameMatch) device.name = nameMatch[1];
}

function finalizeNetworkUSRP(device: Partial<DetectedHardware>): void {
	const ip = device.ipAddress || 'unknown';
	device.id = `usrp-net-${ip.replace(/\./g, '-')}`;
	device.name = device.name || 'Network USRP';
	device.manufacturer = 'Ettus Research';
	device.capabilities = USRP_NET_CAPABILITIES;
	device.compatibleTools = ['spectrum.analysis.usrp', 'cellular.analysis.usrp'];
}

function validateAndPushDevice(
	device: Partial<DetectedHardware>,
	hardware: DetectedHardware[],
	label: string
): void {
	const result = DetectedHardwareSchema.safeParse(device);
	if (result.success) {
		hardware.push(result.data);
		return;
	}
	logger.error(`[network-detector] Invalid network USRP data${label}, skipping`, {
		device,
		errors: result.error.format()
	});
}

function createEmptyNetUSRP(): Partial<DetectedHardware> {
	return {
		category: 'sdr',
		connectionType: 'network',
		status: 'connected',
		lastSeen: Date.now(),
		firstSeen: Date.now()
	};
}

function processNetUSRPLine(
	line: string,
	current: Partial<DetectedHardware> | null,
	hardware: DetectedHardware[]
): Partial<DetectedHardware> | null {
	if (line.includes('Device Address')) {
		if (current?.ipAddress) validateAndPushDevice(current, hardware, '');
		return createEmptyNetUSRP();
	}
	if (current) parseNetworkUSRPLineFields(line, current);
	return current;
}

function parseNetworkUSRPOutput(stdout: string): DetectedHardware[] {
	const hardware: DetectedHardware[] = [];
	let current: Partial<DetectedHardware> | null = null;

	for (const line of stdout.split('\n')) {
		current = processNetUSRPLine(line, current, hardware);
	}
	if (current?.ipAddress) {
		finalizeNetworkUSRP(current);
		validateAndPushDevice(current, hardware, ' (last device)');
	}
	return hardware;
}

async function detectNetworkUSRP(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/uhd_find_devices', ['--args=type=usrp'], {
			timeout: 5000
		});
		return parseNetworkUSRPOutput(stdout);
	} catch {
		return [];
	}
}

// ── Kismet server detection ──

function buildServiceDevice(
	id: string,
	name: string,
	service: string,
	version: string,
	baseUrl: string,
	defaultPort: number,
	tools: string[]
): DetectedHardware {
	const url = new URL(baseUrl);
	return {
		id,
		name,
		category: 'network',
		connectionType: 'network',
		status: 'connected',
		capabilities: { service, version },
		ipAddress: url.hostname,
		port: parseInt(url.port) || defaultPort,
		lastSeen: Date.now(),
		firstSeen: Date.now(),
		compatibleTools: tools
	};
}

async function detectKismetServer(): Promise<DetectedHardware[]> {
	const kismetUrl = env.PUBLIC_KISMET_API_URL;
	const url = new URL('/system/status.json', kismetUrl);
	const data = (await probeJsonService('network-detector.probe.kismet', url.toString())) as {
		kismet_version?: string;
	} | null;
	if (!data) return [];
	return [
		buildServiceDevice(
			'kismet-server',
			'Kismet Server',
			'kismet',
			data.kismet_version || 'unknown',
			kismetUrl,
			2501,
			['wifi.scan.kismet', 'wifi.monitor.kismet']
		)
	];
}

// ── HackRF API server detection ──

async function detectHackRFServer(): Promise<DetectedHardware[]> {
	const hackrfUrl = env.PUBLIC_HACKRF_API_URL;
	const url = new URL('/status', hackrfUrl);
	const data = (await probeJsonService('network-detector.probe.hackrf', url.toString())) as {
		version?: string;
	} | null;
	if (!data) return [];
	return [
		buildServiceDevice(
			'hackrf-server',
			'HackRF API Server',
			'hackrf-api',
			data.version || 'unknown',
			hackrfUrl,
			8092,
			['spectrum.analysis.hackrf']
		)
	];
}

// ── OpenWebRX detection ──

async function detectOpenWebRX(): Promise<DetectedHardware[]> {
	const reachable = await probeReachable('network-detector.probe.openwebrx', env.OPENWEBRX_URL);
	if (!reachable) return [];
	return [
		{
			id: 'openwebrx-server',
			name: 'OpenWebRX Server',
			category: 'network',
			connectionType: 'network',
			status: 'connected',
			capabilities: { service: 'openwebrx', webInterface: true },
			ipAddress: 'localhost',
			port: 8073,
			lastSeen: Date.now(),
			firstSeen: Date.now(),
			compatibleTools: ['spectrum.view.openwebrx']
		}
	];
}

/**
 * Main network device detection function
 */
export async function detectNetworkDevices(): Promise<DetectedHardware[]> {
	logger.info('[NetworkDetector] Scanning for network hardware...');

	const results = await Promise.allSettled([
		detectNetworkUSRP(),
		detectKismetServer(),
		detectHackRFServer(),
		detectOpenWebRX()
	]);

	const allHardware: DetectedHardware[] = [];

	for (const result of results) {
		if (result.status === 'fulfilled') {
			allHardware.push(...result.value);
		}
	}

	logger.info('[NetworkDetector] Found network devices', { count: allHardware.length });

	return allHardware;
}
