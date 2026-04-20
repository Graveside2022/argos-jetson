/**
 * Thin wrappers around `sudo systemctl` for DragonSync's external services.
 * These are pure — no module state — so peers call them freely.
 *
 * @module
 */

import { execFileAsync } from '$lib/server/exec';

export async function isServiceActive(serviceName: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('sudo', ['systemctl', 'is-active', serviceName]);
		return stdout.trim() === 'active';
	} catch {
		return false;
	}
}

export async function startService(serviceName: string): Promise<boolean> {
	try {
		await execFileAsync('sudo', ['systemctl', 'start', serviceName]);
		return true;
	} catch {
		return false;
	}
}

export async function stopService(serviceName: string): Promise<boolean> {
	try {
		await execFileAsync('sudo', ['systemctl', 'stop', serviceName]);
		return true;
	} catch {
		return false;
	}
}
