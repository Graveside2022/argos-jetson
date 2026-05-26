import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

/**
 * Vitest config used ONLY by stryker (test:mutation script).
 *
 * Inherits resolve/aliases/setup from vitest.config.ts; overrides include
 * to scope test discovery to the middleware tests so each mutant runs only
 * the relevant suites — keeps stryker's per-mutant cost cheap on Jetson.
 * Coverage disabled (stryker tracks mutation coverage; v8 coverage on every
 * mutant would 10x runtime).
 *
 * Use the canonical vitest.config.ts for `npm test` / CI.
 */
export default defineConfig({
	...baseConfig,
	test: {
		...baseConfig.test,
		include: [
			'src/lib/server/middleware/**/*.{test,spec}.{js,ts}',
			'tests/unit/rate-limit-middleware.test.ts',
			'tests/unit/rate-limit-middleware-internals.test.ts',
			'tests/unit/response-pipeline.test.ts',
			'tests/unit/ws-origin-guard.test.ts',
			'tests/unit/ws-connection-handler.test.ts'
		],
		exclude: ['node_modules/**', '.stryker-tmp/**'],
		coverage: { enabled: false },
		// Bump from inherited maxWorkers:1 (RPi5-era) to 2. With stryker's
		// concurrency:4 = 4 concurrent stryker test runners × 2 vitest workers
		// each = 8 cores busy on Jetson AGX Orin's 8-core CPU. Full utilization
		// without oversubscription.
		maxWorkers: 2,
		minWorkers: 1,
		pool: 'forks'
	}
});
