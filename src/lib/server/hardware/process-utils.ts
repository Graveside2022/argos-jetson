/**
 * Shared process detection and cleanup utilities for hardware managers.
 * Used by hackrf-manager.ts and alfa-manager.ts to find/kill blocking processes.
 */

import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';

export interface ProcessEntry {
	pid: string;
	name: string;
}

export interface ProcessConfig {
	/** Process binary name (matched via pgrep -x for exact /proc/PID/comm match) */
	name: string;
	/** User-friendly display name for UI; defaults to name if omitted */
	displayName?: string;
	/** Use -f (full cmdline match) instead of -x (exact comm match).
	 *  Required for Python-wrapped tools whose comm is "python3". */
	useCmdlineMatch?: boolean;
	/** Explicit regex passed to `pgrep -f` when useCmdlineMatch is set.
	 *  Overrides `name` as the pattern. Use to anchor matches against
	 *  the interpreter invocation (e.g. `python[0-9.]* .*grgsm_livemon`)
	 *  so shell ancestors that happen to contain the bare tool name as
	 *  an argument to `pgrep`/`pkill` do not self-match. */
	cmdlinePattern?: string;
}

function pgrepFlag(config: ProcessConfig): string {
	return config.useCmdlineMatch ? '-f' : '-x';
}

function pgrepPattern(config: ProcessConfig): string {
	return config.useCmdlineMatch && config.cmdlinePattern ? config.cmdlinePattern : config.name;
}

function displayName(config: ProcessConfig): string {
	return config.displayName ?? config.name;
}

async function findProcessPids(config: ProcessConfig): Promise<ProcessEntry[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', [
			pgrepFlag(config),
			pgrepPattern(config)
		]);
		const label = displayName(config);
		return stdout
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((pid) => ({ pid, name: label }));
	} catch {
		return [];
	}
}

/** Find running processes matching the given configs via pgrep. */
export async function findBlockingProcesses(configs: ProcessConfig[]): Promise<ProcessEntry[]> {
	const results = await Promise.all(configs.map(findProcessPids));
	return results.flat();
}

/** Resolve pkill flag + pattern for a single process config. */
function pkillArgsFor(config: ProcessConfig): [string, string] {
	const flag = config.useCmdlineMatch ? '-f' : '-x';
	const pattern =
		config.useCmdlineMatch && config.cmdlinePattern ? config.cmdlinePattern : config.name;
	return [flag, pattern];
}

/** SIGKILL one config via pkill; swallow "no process" errors. */
async function killOne(config: ProcessConfig): Promise<void> {
	const [flag, pattern] = pkillArgsFor(config);
	try {
		await execFileAsync('/usr/bin/pkill', ['-9', flag, pattern]);
	} catch {
		// Process not found or already dead
	}
}

/** SIGKILL all processes matching the given configs via pkill, then wait for cleanup. */
export async function killMatchingProcesses(
	configs: ProcessConfig[],
	waitMs = 2000
): Promise<void> {
	for (const config of configs) await killOne(config);
	await delay(waitMs);
}
