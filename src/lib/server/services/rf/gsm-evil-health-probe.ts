/**
 * Minimal health probe for GSM Evil — separated from the adapter so the
 * adapter file stays trivial and the probe can be mocked in tests.
 */

import { execFileAsync } from '$lib/server/exec';

const GSM_EVIL_CMD_PATTERNS = ['GsmEvil.py', 'grgsm_livemon'];

export async function getGsmEvilHealth(): Promise<boolean> {
	for (const pattern of GSM_EVIL_CMD_PATTERNS) {
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', pattern]);
			if (stdout.trim().length > 0) return true;
		} catch {
			// pgrep exits 1 when no match — treat as not running for this pattern.
		}
	}
	return false;
}
