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
// Hard cap raised from 1200 → 2000 on 2026-04-29 to support phase-level
// PR bundling per memory `feedback_bulk_pr_bundling.md`. Spec-026 sub-phases
// total ~1700-2000 LOC when bundled (wrapper + spec docs + consumer
// migrations + roadmap flip). 2000 is the new ceiling; soft warn at 500
// stays as the splitting nudge for non-phase-bundled PRs.
const PR_SIZE_SOFT = 500;
const PR_SIZE_HARD = 2000;
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

// ── 3. Tests-required for server-code changes (with type-only carve-out) ─
//
// Default: any non-test .ts/.js change under src/lib/server/ requires a
// matching test delta. Carve-out: micro-PRs whose server-code changes are
// 100% import/export type relocations (and similar pure-leaf edits) skip
// the requirement. Same trick as PRs #46/#47/#48 — those are pure type
// surgery with zero behavioral risk; tests would not add coverage.
//
// Carve-out gates (ALL must hold):
//   (a) Total human-authored LOC ≤ MICRO_LOC_CAP
//   (b) No new .ts / .js source files created (test files OK)
//   (c) Every +/- diff line in src/lib/server/** matches one of:
//       - blank line                          /^[+-]\s*$/
//       - import/export type ...              /^[+-]\s*(import|export)\s+type\b/
//       - line comment                        /^[+-]\s*\/\//
//       - block comment line                  /^[+-]\s*\*/
//
// Conservative bias: false-negative (gate fires when it shouldn't, e.g. on
// multi-line import { type X, type Y } blocks) is preferred over
// false-positive (gate skips real behavioral change). When carve-out fires,
// we emit a warn() recording the heuristic + LOC count for audit.
//
// Audit: PR comment shows EITHER fail() (no carve-out) OR warn() with the
// LOC count + file count. No silent passes. Mechanical detection only —
// no labels, no titles, no human override.
//
// References:
//   - https://danger.systems/js/reference.html (linesOfCode, diffForFile,
//     created_files, schedule)
//   - https://danger.systems/js/guides/the_dangerfile.html (async via
//     schedule is required)
//   - https://github.com/danger/danger-js/blob/main/source/dsl/GitDSL.ts
//     (TextDiff shape: {before, after, diff, added, removed})

const MICRO_LOC_CAP = 10;
const TYPE_ONLY_LINE_PATTERNS = [
	/^[+-]\s*$/,
	/^[+-]\s*(import|export)\s+type\b/,
	/^[+-]\s*\/\//,
	/^[+-]\s*\*/
];

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

schedule(async () => {
	if (!serverCodeChanged || testChanged) {
		return; // gate doesn't fire OR is already satisfied
	}

	// Try the carve-out before the fail(). All gates are conservative —
	// any failure to evaluate falls through to the original fail().
	try {
		const total = await danger.git.linesOfCode();
		let generated = 0;
		for (const pat of GENERATED_GLOBS) {
			generated += await danger.git.linesOfCode(pat);
		}
		const lineCount = Math.max(0, total - generated);

		if (lineCount <= MICRO_LOC_CAP) {
			const noNewSourceFiles = (danger.git.created_files || []).every(
				(f) => !/\.(ts|js)$/.test(f) || /\.(test|spec|d)\./.test(f)
			);

			if (noNewSourceFiles) {
				const serverFiles = changed.filter((f) => f.startsWith('src/lib/server/'));
				let allTypeOnly = serverFiles.length > 0;

				for (const f of serverFiles) {
					const td = await danger.git.diffForFile(f);
					if (!td) {
						allTypeOnly = false;
						break;
					}
					const meaningful = td.diff
						.split('\n')
						.filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l));
					const fileTypeOnly = meaningful.every((l) =>
						TYPE_ONLY_LINE_PATTERNS.some((re) => re.test(l))
					);
					if (!fileTypeOnly) {
						allTypeOnly = false;
						break;
					}
				}

				if (allTypeOnly) {
					warn(
						`Tests-required gate skipped: PR is ${lineCount} human-authored line(s) and contains only type-import/export edits across ${serverFiles.length} server file(s). Auditable via diff. (Carve-out rule: dangerfile.js, see TYPE_ONLY_LINE_PATTERNS.)`
					);
					return;
				}
			}
		}
	} catch (err) {
		// Couldn't evaluate carve-out (e.g. shallow clone, missing git
		// metadata). Fall through to fail() below — fail-closed bias.
		const msg = err instanceof Error ? err.message : String(err);
		warn(
			`Tests-required carve-out skipped due to git error: ${msg}. Falling back to strict gate.`
		);
	}

	fail(
		'Server code under src/lib/server/ changed but no test files were added or modified. Add unit or integration tests.'
	);
});

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
