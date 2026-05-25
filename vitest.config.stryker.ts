import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest config used ONLY by stryker (test:mutation script).
 *
 * Scopes test discovery to src/lib/server/api so each mutant runs only
 * the 2 colocated tests there (create-handler.test.ts, error-utils.test.ts)
 * — keeps stryker's per-mutant cost cheap on RPi5/Jetson single-fork.
 *
 * Use the canonical vitest.config.ts for `npm test` / CI.
 */
export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			$app: path.resolve('./.svelte-kit/runtime/app')
		}
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		include: ['src/lib/server/api/**/*.{test,spec}.{js,ts}'],
		exclude: ['node_modules/**', '.stryker-tmp/**'],
		testTimeout: 30000,
		hookTimeout: 30000,
		maxWorkers: 1,
		minWorkers: 1,
		pool: 'forks'
	}
});
