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

const pr = danger.github.pr;
const changed = [...danger.git.modified_files, ...danger.git.created_files];

// ── 1. PR size cap ─────────────────────────────────────────────────────
const PR_SIZE_SOFT = 500;
const PR_SIZE_HARD = 1200;
const lineCount = (pr.additions ?? 0) + (pr.deletions ?? 0);
if (lineCount > PR_SIZE_HARD) {
	fail(
		`PR is ${lineCount} lines (> ${PR_SIZE_HARD}). Split into smaller PRs — reviewers cannot meaningfully review at this scale.`
	);
} else if (lineCount > PR_SIZE_SOFT) {
	warn(`PR is ${lineCount} lines (> ${PR_SIZE_SOFT}). Consider splitting for easier review.`);
}

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
// Only count real test files: path must be under src/ or tests/ AND end with a
// known test-file pattern. Prior version counted any tests/ file (e.g. fixtures,
// snapshots), letting non-test changes pass the "tests required" gate.
const testChanged = changed.some((f) => /^(src|tests)\/.*\.(test|spec)\.(ts|js)$/.test(f));
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
