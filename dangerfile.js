/* eslint-disable no-undef */
/**
 * Argos PR shape rules via danger.js.
 *
 * Runs per-PR in .github/workflows/danger.yml. Supplements commitlint
 * (which enforces message shape) and CodeRabbit (which reviews code
 * quality) with PR-level structural rules:
 *
 *   1. Size cap — warn on PRs the reviewer can't reasonably load.
 *   2. Cross-subsystem sprawl — warn when a single PR spans more than
 *      three top-level src/ areas.
 *   3. Tests-required — fail when server code changes without a
 *      matching test delta.
 *   4. Migration-drift — warn when migrations and schema.sql drift
 *      out of sync.
 *
 * These rules start conservative (mostly warn) and can be tightened
 * once the team sees how they land on live PRs. `fail` rules block the
 * merge; `warn` rules post a comment but do not block.
 */

// Include deleted files too — a PR that deletes server code is still a
// server-code change and must satisfy the tests-required gate. Dedupe so a
// file that appears in multiple danger.git arrays isn't counted twice.
const changed = Array.from(
	new Set([
		...(danger.git.modified_files || []),
		...(danger.git.created_files || []),
		...(danger.git.deleted_files || [])
	])
);

// ── 1. PR size cap (human-authored lines only — exclude generated files) ─
const PR_SIZE_SOFT = 500;
const PR_SIZE_HARD = 1200;
// Globs for files that bloat the raw diff without being reviewable prose.
// Lock files, changelogs, and snapshot fixtures all fall in here — they can
// legitimately add thousands of lines on a small PR and would defeat the gate.
const GENERATED_GLOBS = [
	'package-lock.json',
	'**/package-lock.json',
	'yarn.lock',
	'pnpm-lock.yaml',
	'**/pnpm-lock.yaml',
	'CHANGELOG.md',
	'**/CHANGELOG.md'
];
schedule(async () => {
	try {
		const total = await danger.git.linesOfCode();
		let generated = 0;
		for (const pat of GENERATED_GLOBS) {
			generated += await danger.git.linesOfCode(pat);
		}
		const lineCount = Math.max(0, total - generated);
		if (lineCount > PR_SIZE_HARD) {
			fail(
				`PR is ${lineCount} human-authored lines (> ${PR_SIZE_HARD}). Split into smaller PRs — reviewers cannot meaningfully review at this scale. Generated files excluded: ${generated} lines.`
			);
		} else if (lineCount > PR_SIZE_SOFT) {
			warn(
				`PR is ${lineCount} human-authored lines (> ${PR_SIZE_SOFT}). Consider splitting for easier review.`
			);
		}
	} catch (err) {
		// Git metadata occasionally missing in CI (e.g. shallow clone edge cases).
		// Fail loud with the error so the operator can retry or widen fetch-depth
		// rather than silently skipping the size cap.
		const msg = err instanceof Error ? err.message : String(err);
		fail(
			`Danger size-cap gate could not compute lines-of-code: ${msg}. Retry the CI run or ensure the checkout action uses fetch-depth: 0.`
		);
	}
});

// ── 2. Cross-subsystem sprawl ──────────────────────────────────────────
function topLevelSrcDir(path) {
	const m = path.match(/^src\/([^/]+)\//);
	return m ? m[1] : null;
}
const srcDirs = new Set(changed.map(topLevelSrcDir).filter(Boolean));
if (srcDirs.size > 3) {
	warn(
		`PR touches ${srcDirs.size} top-level src/ subsystems (${[...srcDirs].join(
			', '
		)}). Likely should be split into per-subsystem PRs.`
	);
}

// ── 3. Tests-required for server-code changes ──────────────────────────
const serverCodeChanged = changed.some(
	(f) =>
		f.startsWith('src/lib/server/') &&
		(f.endsWith('.ts') || f.endsWith('.js')) &&
		!f.endsWith('.test.ts') &&
		!f.endsWith('.test.js') &&
		!f.endsWith('.spec.ts') &&
		!f.endsWith('.spec.js')
);
// Only match server-related test locations. Prior regex accepted any src/
// test (e.g. src/lib/components/**/*.test.ts), letting a UI-only test satisfy
// a server-code-changed gate. Narrow to server inline tests (src/lib/server)
// + anything under tests/ (integration/unit/security/etc., which do exercise
// server behavior by convention in this repo).
const testChanged = changed.some((f) =>
	/^(src\/lib\/server|tests)\/.*\.(test|spec)\.(ts|js)$/.test(f)
);
if (serverCodeChanged && !testChanged) {
	fail(
		'Server code under src/lib/server/ changed but no test files were added or modified. Add unit or integration tests.'
	);
}

// ── 4. Migration vs schema drift ───────────────────────────────────────
const migrationTouched = changed.some((f) => f.startsWith('src/lib/server/db/migrations/'));
const schemaTouched = changed.some((f) => f === 'src/lib/server/db/schema.sql');
if (migrationTouched && !schemaTouched) {
	warn(
		'Migration files changed but src/lib/server/db/schema.sql was not updated. Keep the canonical schema in sync.'
	);
}
if (schemaTouched && !migrationTouched) {
	warn(
		'schema.sql changed but no new migration file was added. Fresh clones will be fine; existing databases need a migration.'
	);
}
