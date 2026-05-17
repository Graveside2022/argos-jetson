/**
 * journald-backed system log reader for `GET /api/system/logs`.
 *
 * Queries the systemd journal one-shot via `journalctl --output=json` for the
 * Argos service units, groups entries by unit, and reports an error count.
 *
 * Why journald (not the in-memory `logger` circular buffer): the buffer holds
 * only ~1000 entries since process start and is lost on restart — it cannot
 * answer a 24h (`minutes=1440`) query. journald is disk-persistent and capped,
 * so it is the real source of truth for "recent system logs".
 *
 * Access: the Argos services run as `jetson2`, which is in the `adm` group —
 * journal reads succeed WITHOUT `sudo`. If Argos is ever redeployed under a
 * service user not in `adm`, grant journal access with
 * `usermod -aG systemd-journal <user>` (preferred over a sudoers entry — no
 * privilege escalation).
 *
 * @module
 */

import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { logger } from '$lib/utils/logger';

const JOURNALCTL = '/usr/bin/journalctl';

/**
 * systemd units queried for logs. Hand-curated and verified to exist on the
 * host — add new Argos units here explicitly when they ship (explicit beats a
 * magic glob). `argos-kismet` is intentionally absent: no such unit exists.
 */
const ARGOS_UNITS = [
	'argos-final.service',
	'argos-dev.service',
	'argos-process-manager.service',
	'argos-cpu-protector.service',
	'argos-wifi-resilience.service',
	'gpsd.service'
] as const;

/** Hard cap on journal lines returned, regardless of the time window. */
const MAX_LINES = 2000;
/** journalctl query timeout — a one-shot read should be near-instant. */
const QUERY_TIMEOUT_MS = 8000;
/** stdout buffer ceiling (`-n MAX_LINES` keeps real output well under this). */
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;

/** journald numeric priority for an error: emerg(0)..err(3) are "errors". */
const ERROR_PRIORITY_MAX = 3;

export type LogSeverity = 'error' | 'warn' | 'all';

export interface LogSource {
	source: string;
	entries: string[];
}

export interface SystemLogsResult {
	success: boolean;
	minutes?: number;
	total_errors?: number;
	sources?: LogSource[];
	error?: string;
}

/** Parsed shape of a single `journalctl --output=json` line (fields we read). */
interface JournalEntry {
	MESSAGE?: string | number[];
	PRIORITY?: string;
	_SYSTEMD_UNIT?: string;
	SYSLOG_IDENTIFIER?: string;
	__REALTIME_TIMESTAMP?: string;
}

/**
 * Map a requested severity to a journalctl `-p` priority filter.
 * `-p <priority>` matches that priority AND everything more severe, so
 * `warning` covers warnings + errors. `all` applies no filter.
 */
export function severityToPriority(severity: LogSeverity): string | null {
	switch (severity) {
		case 'error':
			return 'err';
		case 'warn':
			return 'warning';
		case 'all':
			return null;
	}
}

/** Build the argument vector for the one-shot journalctl query. */
export function buildJournalctlArgs(minutes: number, severity: LogSeverity): string[] {
	const args: string[] = [];
	for (const unit of ARGOS_UNITS) {
		args.push('-u', unit);
	}
	args.push('--since', `-${minutes}min`, '--output=json', '--no-pager', '-n', String(MAX_LINES));
	const priority = severityToPriority(severity);
	if (priority) {
		args.push('-p', priority);
	}
	return args;
}

/** Decode a journald MESSAGE field, which may be a string or a UTF-8 byte array. */
function normalizeMessage(raw: string | number[] | undefined): string {
	if (typeof raw === 'string') return raw;
	if (Array.isArray(raw)) return Buffer.from(raw).toString('utf8');
	return '';
}

/** Prefix an entry with its ISO timestamp when journald provides one. */
function formatEntry(entry: JournalEntry, message: string): string {
	const usec = Number(entry.__REALTIME_TIMESTAMP);
	if (!Number.isFinite(usec)) return message;
	return `${new Date(usec / 1000).toISOString()} ${message}`;
}

export interface ParsedLogs {
	sources: LogSource[];
	totalErrors: number;
}

/** A single journal line reduced to the fields the response needs. */
interface ParsedLine {
	unit: string;
	entry: string;
	isError: boolean;
}

/** Parse + JSON-decode one stdout line. Blank/malformed lines yield null. */
function safeParseEntry(line: string): JournalEntry | null {
	const trimmed = line.trim();
	if (!trimmed) return null;
	try {
		return JSON.parse(trimmed) as JournalEntry;
	} catch {
		return null;
	}
}

/** Resolve the grouping key for an entry: unit → syslog id → 'unknown'. */
function resolveUnit(entry: JournalEntry): string {
	return entry._SYSTEMD_UNIT ?? entry.SYSLOG_IDENTIFIER ?? 'unknown';
}

/** True when the entry is error-level (journald priority emerg(0)..err(3)). */
function isErrorEntry(entry: JournalEntry): boolean {
	const priority = Number(entry.PRIORITY);
	return Number.isFinite(priority) && priority <= ERROR_PRIORITY_MAX;
}

/** Reduce one stdout line to a ParsedLine, or null if it carries no message. */
function parseLine(line: string): ParsedLine | null {
	const entry = safeParseEntry(line);
	if (!entry) return null;
	const message = normalizeMessage(entry.MESSAGE);
	if (!message) return null;
	return {
		unit: resolveUnit(entry),
		entry: formatEntry(entry, message),
		isError: isErrorEntry(entry)
	};
}

/** Add one stdout line into the unit map. Returns true if it was an error. */
function accumulateLine(line: string, byUnit: Map<string, string[]>): boolean {
	const parsed = parseLine(line);
	if (!parsed) return false;
	const list = byUnit.get(parsed.unit) ?? [];
	list.push(parsed.entry);
	byUnit.set(parsed.unit, list);
	return parsed.isError;
}

/**
 * Parse `journalctl --output=json` stdout (one JSON object per line) into
 * per-unit sources. Malformed or blank lines are skipped — never throws.
 *
 * `totalErrors` counts entries with priority <= err(3) across ALL sources,
 * independent of the `severity` filter, so callers that threshold on it
 * (e.g. the system-inspector MCP `analyzeLogs`) get a stable error count.
 */
export function parseJournaldJson(stdout: string): ParsedLogs {
	const byUnit = new Map<string, string[]>();
	let totalErrors = 0;

	for (const line of stdout.split('\n')) {
		if (accumulateLine(line, byUnit)) totalErrors++;
	}

	return {
		sources: [...byUnit.entries()].map(([source, entries]) => ({ source, entries })),
		totalErrors
	};
}

/**
 * Query journald for recent Argos service logs. Never throws — every failure
 * mode (journalctl missing, permission denied, timeout) resolves to
 * `{ success: false, error }`.
 */
export async function getSystemLogs(
	minutes: number,
	severity: LogSeverity
): Promise<SystemLogsResult> {
	try {
		const { stdout } = await execFileAsync(JOURNALCTL, buildJournalctlArgs(minutes, severity), {
			timeout: QUERY_TIMEOUT_MS,
			maxBuffer: MAX_BUFFER_BYTES
		});
		const { sources, totalErrors } = parseJournaldJson(stdout);
		return { success: true, minutes, total_errors: totalErrors, sources };
	} catch (err) {
		logger.error('[api/system/logs] journald query failed', { error: errMsg(err) });
		return { success: false, error: errMsg(err) };
	}
}
