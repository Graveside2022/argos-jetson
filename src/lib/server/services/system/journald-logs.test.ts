/**
 * Unit tests for the journald-backed system log reader.
 *
 * The parser + arg builder are pure and tested directly. `getSystemLogs` is
 * tested with `$lib/server/exec` mocked — no real `journalctl` is invoked.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({ execFileAsync: vi.fn() }));

import { execFileAsync } from '$lib/server/exec';

import {
	buildJournalctlArgs,
	getSystemLogs,
	parseJournaldJson,
	severityToPriority
} from './journald-logs';

const mockExec = vi.mocked(execFileAsync);

/** Build one `journalctl --output=json` stdout line. */
function jline(fields: Record<string, unknown>): string {
	return JSON.stringify(fields);
}

afterEach(() => {
	vi.clearAllMocks();
});

describe('severityToPriority', () => {
	it('maps error to err', () => {
		expect(severityToPriority('error')).toBe('err');
	});
	it('maps warn to warning', () => {
		expect(severityToPriority('warn')).toBe('warning');
	});
	it('maps all to null (no filter)', () => {
		expect(severityToPriority('all')).toBeNull();
	});
});

describe('buildJournalctlArgs', () => {
	it('includes a -u flag for every Argos unit', () => {
		const args = buildJournalctlArgs(5, 'error');
		expect(args.filter((a) => a === '-u').length).toBeGreaterThanOrEqual(6);
		expect(args).toContain('argos-final.service');
		expect(args).toContain('argos-dev.service');
	});
	it('sets the --since window from minutes', () => {
		const args = buildJournalctlArgs(90, 'all');
		const idx = args.indexOf('--since');
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(args[idx + 1]).toBe('-90min');
	});
	it('requests JSON output with a line cap', () => {
		const args = buildJournalctlArgs(5, 'error');
		expect(args).toContain('--output=json');
		expect(args).toContain('--no-pager');
		expect(args).toContain('-n');
	});
	it('adds -p err for severity=error', () => {
		const args = buildJournalctlArgs(5, 'error');
		const idx = args.indexOf('-p');
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(args[idx + 1]).toBe('err');
	});
	it('adds -p warning for severity=warn', () => {
		const args = buildJournalctlArgs(5, 'warn');
		expect(args[args.indexOf('-p') + 1]).toBe('warning');
	});
	it('omits -p entirely for severity=all', () => {
		expect(buildJournalctlArgs(5, 'all')).not.toContain('-p');
	});
});

describe('parseJournaldJson — grouping & counts', () => {
	it('groups entries by systemd unit', () => {
		const stdout = [
			jline({ MESSAGE: 'a', PRIORITY: '6', _SYSTEMD_UNIT: 'argos-final.service' }),
			jline({ MESSAGE: 'b', PRIORITY: '6', _SYSTEMD_UNIT: 'argos-dev.service' }),
			jline({ MESSAGE: 'c', PRIORITY: '6', _SYSTEMD_UNIT: 'argos-final.service' })
		].join('\n');
		const { sources } = parseJournaldJson(stdout);
		const final = sources.find((s) => s.source === 'argos-final.service');
		const dev = sources.find((s) => s.source === 'argos-dev.service');
		expect(final?.entries).toHaveLength(2);
		expect(dev?.entries).toHaveLength(1);
	});

	it('counts only priority <= 3 as errors', () => {
		const stdout = [
			jline({ MESSAGE: 'emerg', PRIORITY: '0', _SYSTEMD_UNIT: 'u' }),
			jline({ MESSAGE: 'err', PRIORITY: '3', _SYSTEMD_UNIT: 'u' }),
			jline({ MESSAGE: 'warning', PRIORITY: '4', _SYSTEMD_UNIT: 'u' }),
			jline({ MESSAGE: 'info', PRIORITY: '6', _SYSTEMD_UNIT: 'u' })
		].join('\n');
		expect(parseJournaldJson(stdout).totalErrors).toBe(2);
	});
});

describe('parseJournaldJson — edge cases', () => {
	it('decodes a MESSAGE byte array to UTF-8', () => {
		const bytes = [...Buffer.from('héllo', 'utf8')];
		const stdout = jline({ MESSAGE: bytes, PRIORITY: '6', _SYSTEMD_UNIT: 'u' });
		expect(parseJournaldJson(stdout).sources[0].entries[0]).toContain('héllo');
	});

	it('skips blank and malformed lines without throwing', () => {
		const stdout = [
			jline({ MESSAGE: 'ok', PRIORITY: '6', _SYSTEMD_UNIT: 'u' }),
			'',
			'{ not valid json',
			'   ',
			jline({ MESSAGE: 'ok2', PRIORITY: '6', _SYSTEMD_UNIT: 'u' })
		].join('\n');
		const { sources } = parseJournaldJson(stdout);
		expect(sources[0].entries).toHaveLength(2);
	});

	it('falls back to SYSLOG_IDENTIFIER then "unknown" when no _SYSTEMD_UNIT', () => {
		const stdout = [
			jline({ MESSAGE: 'a', PRIORITY: '6', SYSLOG_IDENTIFIER: 'gpsd' }),
			jline({ MESSAGE: 'b', PRIORITY: '6' })
		].join('\n');
		const { sources } = parseJournaldJson(stdout);
		expect(sources.map((s) => s.source).sort()).toEqual(['gpsd', 'unknown']);
	});

	it('prefixes entries with an ISO timestamp from __REALTIME_TIMESTAMP', () => {
		const usec = Date.UTC(2026, 0, 2, 3, 4, 5) * 1000;
		const stdout = jline({
			MESSAGE: 'msg',
			PRIORITY: '6',
			_SYSTEMD_UNIT: 'u',
			__REALTIME_TIMESTAMP: String(usec)
		});
		expect(parseJournaldJson(stdout).sources[0].entries[0]).toBe(
			'2026-01-02T03:04:05.000Z msg'
		);
	});

	it('returns empty result for empty stdout', () => {
		expect(parseJournaldJson('')).toEqual({ sources: [], totalErrors: 0 });
	});
});

describe('getSystemLogs', () => {
	it('returns a success result with parsed sources', async () => {
		mockExec.mockResolvedValue({
			stdout: jline({ MESSAGE: 'boom', PRIORITY: '3', _SYSTEMD_UNIT: 'argos-final.service' }),
			stderr: ''
		});
		const result = await getSystemLogs(5, 'error');
		expect(result.success).toBe(true);
		expect(result.minutes).toBe(5);
		expect(result.total_errors).toBe(1);
		expect(result.sources?.[0].source).toBe('argos-final.service');
	});

	it('resolves to a clean failure when journalctl rejects', async () => {
		mockExec.mockRejectedValue(new Error('spawn /usr/bin/journalctl ENOENT'));
		const result = await getSystemLogs(5, 'error');
		expect(result.success).toBe(false);
		expect(result.error).toContain('ENOENT');
		expect(result.sources).toBeUndefined();
	});
});
