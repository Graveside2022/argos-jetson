/**
 * Argos commit-message policy — Conventional Commits 1.0.
 *
 * Format:
 *   <type>(<optional-scope>): <subject>
 *
 * Examples:
 *   feat(rf): add RSSI-weighted AP centroid layer
 *   fix(bluedragon): persist RSSI to signals table on frame ingest
 *   chore(deps): pin h3-js@4.4.0
 *
 * Validated locally via .husky/commit-msg and re-validated per-PR in
 * .github/workflows/commitlint.yml so a local --no-verify cannot land a
 * malformed message on a PR.
 */
export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'type-enum': [
			2,
			'always',
			[
				'feat',
				'fix',
				'docs',
				'style',
				'refactor',
				'perf',
				'test',
				'build',
				'ci',
				'chore',
				'revert'
			]
		],
		'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'header-max-length': [2, 'always', 100],
		'body-max-line-length': [1, 'always', 100],
		'footer-max-line-length': [1, 'always', 100]
	}
};
