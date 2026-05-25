/**
 * Stryker mutation testing config (auto-discovered by `stryker run`).
 *
 * Scope starts narrow (server API utilities) — mutation testing is slow on
 * RPi5/Jetson with single-fork vitest (~30+ min per dir). Widen via
 * `npm run test:mutation -- --mutate <pattern>` once a baseline lands.
 */
export default {
	packageManager: 'npm',
	// command runner instead of vitest-runner: the vitest-runner package's
	// programmatic API passes an empty file list when `related: false` →
	// "No tests were found"; with related: true it bails on the
	// dep-graph scan. command runner just spawns `vitest run` per mutant
	// using vitest.config.stryker.ts (20 tests, 3s cold-start ≈ 10 min
	// for 197 mutants). Trade-off: no per-test coverage analysis (already
	// off anyway).
	testRunner: 'command',
	commandRunner: {
		command: 'npx vitest run --config vitest.config.stryker.ts'
	},
	// typescript checker disabled — bare tsc rejects named imports from
	// .svelte files (e.g. `import { RF_CENTROID_LAYER_ID } from
	// './Layer.svelte'`) that Svelte's language tools handle via
	// <script module> context. svelte-check covers TS validation in CI;
	// stryker only needs to mutate + run tests.
	checkers: [],
	reporters: ['progress', 'clear-text', 'html', 'json'],
	htmlReporter: { fileName: 'reports/mutation/mutation.html' },
	jsonReporter: { fileName: 'reports/mutation/mutation.json' },
	// coverageAnalysis: 'off' — bypasses stryker's vitest-runner
	// --related lookup entirely (kept failing with "No tests were found"
	// even on relative-import tests). Trade-off: each mutant runs ALL
	// tests in the scoped config (only 20 tests here, so cheap).
	coverageAnalysis: 'off',
	// concurrency 4 — Jetson AGX Orin has 8 cores + 64GB RAM (plenty of
	// headroom). The earlier `concurrency: 1` was a leftover from the RPi5
	// era (8GB, 4 cores). On Jetson each mutation run uses ~500MB RSS so
	// 4 parallel = ~2GB total, trivial. Cuts per-module mutation time ~4x.
	// For multi-module parallel runs, dispatch separate stryker instances
	// each with --reporters-html-fileName overrides to avoid report collision.
	concurrency: 4,
	timeoutMS: 60000,
	timeoutFactor: 2,
	dryRunTimeoutMinutes: 10,
	mutate: [
		'src/lib/utils/**/*.ts',
		'!src/lib/utils/**/*.test.ts',
		'!src/lib/utils/**/*.spec.ts',
		'!src/lib/utils/**/*.d.ts'
	],
	ignorePatterns: [
		'node_modules',
		// '.svelte-kit' deliberately NOT ignored — sveltekit() vite
		// plugin needs .svelte-kit/runtime/app to resolve $app/* aliases.
		// Without it, vitest loads setup but finds 0 tests in sandbox.
		'build',
		'coverage',
		'reports',
		'.rollback',
		'tactical',
		'.claude',
		'.tessl',
		'.agents',
		'.github/skills',
		'.trunk',
		'.stryker-tmp',
		'.git'
	],
	thresholds: { high: 80, low: 60, break: null },
	tempDirName: '.stryker-tmp',
	cleanTempDir: true
};
