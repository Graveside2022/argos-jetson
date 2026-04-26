import { createHandler } from '$lib/server/api/create-handler';
import { execFileAsync } from '$lib/server/exec';

interface PortServiceDef {
	name: string;
	port: number;
	process: string;
}

/** Port-based services — health = process running AND port listening. */
const MONITORED_SERVICES: PortServiceDef[] = [
	{ name: 'kismet', port: 2501, process: 'kismet' },
	{ name: 'argos-logs', port: 5173, process: 'vite' }
];

/**
 * Systemd-managed services that don't expose listenable ports — health
 * derives from `systemctl show -p ActiveState`. Covers the Argos managed
 * units plus host-level dependencies (gpsd, earlyoom). Stays conservative:
 * only units operators actually monitor; not the entire argos-* fleet
 * (some are dev-only or one-shot).
 */
const SYSTEMD_UNITS = [
	'argos-final',
	'argos-startup',
	'argos-kismet',
	'argos-droneid',
	'bluehood',
	'gsmevil-patch',
	'gpsd',
	'earlyoom'
] as const;

/** Lookup table: [processRunning][portListening] → health status */
const HEALTH_STATUS_MAP: Record<string, string> = {
	'true:true': 'healthy',
	'true:false': 'degraded',
	'false:true': 'zombie',
	'false:false': 'stopped'
};

/** Determine health status from process and port state */
function deriveHealthStatus(processRunning: boolean, portListening: boolean): string {
	return HEALTH_STATUS_MAP[`${processRunning}:${portListening}`] ?? 'stopped';
}

/** Map systemd ActiveState into the same health vocabulary the port probe uses. */
function mapActiveStateToHealth(state: string): string {
	if (state === 'active') return 'healthy';
	if (state === 'failed') return 'failed';
	return 'stopped';
}

/** Check whether a process matching the given pattern is running, return its PID */
async function checkProcess(pattern: string): Promise<{ running: boolean; pid: number | null }> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', pattern]);
		if (stdout.trim()) {
			return { running: true, pid: parseInt(stdout.trim().split('\n')[0]) };
		}
	} catch {
		// pgrep exits non-zero when no match found
	}
	return { running: false, pid: null };
}

/** Check whether a TCP port has an active listener */
async function checkPort(port: number): Promise<boolean> {
	try {
		await execFileAsync('/usr/bin/lsof', [`-i:${port}`, '-sTCP:LISTEN']);
		return true;
	} catch {
		return false;
	}
}

/** Probe a single port-based service and return its status record */
async function probeService(service: PortServiceDef) {
	const [proc, portListening] = await Promise.all([
		checkProcess(service.process),
		checkPort(service.port)
	]);

	return {
		name: service.name,
		status: deriveHealthStatus(proc.running, portListening),
		process_running: proc.running,
		port_listening: portListening,
		port: service.port,
		pid: proc.pid
	};
}

/** Probe a systemd unit via `systemctl show -p ActiveState`. Always exits 0. */
async function probeSystemdUnit(unit: string) {
	let activeState = 'unknown';
	try {
		const { stdout } = await execFileAsync('/usr/bin/systemctl', [
			'show',
			'-p',
			'ActiveState',
			'--value',
			unit
		]);
		const value = stdout.trim();
		if (value) activeState = value;
	} catch {
		// systemctl missing or refused — leave activeState='unknown' → status=stopped.
	}

	return {
		name: unit,
		status: mapActiveStateToHealth(activeState),
		process_running: activeState === 'active',
		port_listening: false,
		port: null as number | null,
		pid: null as number | null,
		systemd_active_state: activeState
	};
}

export const GET = createHandler(async () => {
	const [portResults, systemdResults] = await Promise.all([
		Promise.all(MONITORED_SERVICES.map(probeService)),
		Promise.all(SYSTEMD_UNITS.map((u) => probeSystemdUnit(u)))
	]);

	const services = [...portResults, ...systemdResults];
	const healthyCount = services.filter((r) => r.status === 'healthy').length;
	const totalCount = services.length;
	const overallHealth = healthyCount === totalCount ? 'healthy' : 'degraded';

	return {
		success: true,
		overall_health: overallHealth,
		services,
		healthy_count: healthyCount,
		total_count: totalCount
	};
});
