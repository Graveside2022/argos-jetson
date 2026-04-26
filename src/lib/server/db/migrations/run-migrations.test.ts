import { readdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

// Regression tests for the migration ordering bug fixed by renaming
// `008_extend_missions_for_strip.sql` to `20260423_extend_missions_for_strip.sql`.
// ASCII-alphabetical `readdirSync().sort()` placed `008_*` before `20260412_*`
// (because `'0' < '2'`), so the ALTER TABLE migration ran before the CREATE
// TABLE migration and threw `no such table: missions`. The rename keeps both
// in the date-prefixed convention so the create comes first.
const migrationsPath = dirname(fileURLToPath(import.meta.url));

function sortedMigrations(): string[] {
	return readdirSync(migrationsPath)
		.filter((f) => (f.endsWith('.sql') || f.endsWith('.ts')) && f !== 'run-migrations.ts')
		.sort();
}

describe('migration filename ordering', () => {
	it('create_reports_missions sorts before extend_missions_for_strip', () => {
		const files = sortedMigrations();
		const createIdx = files.indexOf('20260412_create_reports_missions.sql');
		const extendIdx = files.indexOf('20260423_extend_missions_for_strip.sql');

		expect(createIdx).toBeGreaterThanOrEqual(0);
		expect(extendIdx).toBeGreaterThanOrEqual(0);
		expect(extendIdx).toBeGreaterThan(createIdx);
	});

	it('does not contain the legacy 008_extend_missions filename', () => {
		const files = readdirSync(migrationsPath);
		expect(files).not.toContain('008_extend_missions_for_strip.sql');
	});

	it('all date-prefixed migrations sort after legacy 0XX-prefixed ones', () => {
		const files = sortedMigrations();
		const lastLegacy = files
			.map((f, i) => (/^0\d\d_/.test(f) ? i : -1))
			.filter((i) => i >= 0)
			.pop();
		const firstDated = files.findIndex((f) => /^2026\d{4}_/.test(f));

		if (lastLegacy !== undefined && firstDated >= 0) {
			expect(firstDated).toBeGreaterThan(lastLegacy);
		}
	});
});
