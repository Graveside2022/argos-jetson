import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { optimizeCss } from 'carbon-preprocess-svelte';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

import { terminalPlugin } from './config/vite-plugin-terminal';

/**
 * Resolve node_modules to its real filesystem path so Vite's `/@fs/` handler
 * serves files from the symlink TARGET when node_modules is a symlink (the
 * Argos worktree dev workflow symlinks `<worktree>/node_modules` to the main
 * checkout's `node_modules` to avoid duplicating ~4 GB per worktree). Without
 * this, Vite resolves the symlink in import requests but the resolved real
 * path falls outside the auto-detected workspace root → 403.
 * Falls back to the project-relative path if `realpathSync` throws (e.g.
 * fresh checkout with no node_modules yet — first `npm install` fixes it).
 */
function nodeModulesRealRoot(): string {
	try {
		return realpathSync(resolve(process.cwd(), 'node_modules'));
	} catch {
		return resolve(process.cwd(), 'node_modules');
	}
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [
			tailwindcss(),
			sentrySvelteKit({
				org: 'us-army-2k',
				project: 'argos',
				authToken: env.SENTRY_AUTH_TOKEN,
				autoUploadSourceMaps: Boolean(env.SENTRY_AUTH_TOKEN),
				telemetry: false
			}),
			sveltekit(),
			// Carbon's documented production CSS optimization: prunes unused Carbon
			// styles from the bundle (build-only, enforce:post). Cuts the global
			// g100 theme CSS that inflates first-paint style-recalc. (carbon-
			// preprocess-svelte README; demo shows ~91% CSS reduction.)
			optimizeCss(),
			terminalPlugin(),
			devtoolsJson()
		],
		server: {
			host: '0.0.0.0',
			port: 5173,
			// fs.allow — required for git-worktree dev where node_modules is a
			// symlink to the main checkout. Without this, requests for
			// `/@fs/<resolved-real-path>` return 403 because the resolved path
			// falls outside the auto-detected workspace root (the worktree dir).
			//   [0] searchForWorkspaceRoot(cwd) — preserves Vite's default
			//       workspace discovery (package.json `workspaces` /
			//       lerna.json / pnpm-workspace.yaml lookup).
			//   [1] nodeModulesRealRoot() — explicit real path of the
			//       node_modules symlink target (the main-checkout path
			//       under `.claude/worktrees/<name>/` worktrees).
			//   [2] '..' — parent of the worktree dir, covers sibling
			//       worktrees and shared assets imported via relative paths.
			// Ref: https://vite.dev/config/server-options#server-fs-allow
			fs: { allow: [searchForWorkspaceRoot(process.cwd()), nodeModulesRealRoot(), '..'] },
			watch: {
				ignored: [
					'**/*.db',
					'**/*.db-wal',
					'**/*.db-shm',
					'**/*.sqlite',
					'**/*.log',
					'**/logs/**',
					'**/coverage/**',
					'**/test-results/**',
					'**/tmp/**',
					'**/data/**',
					'**/.svelte-kit/output/**'
				]
			}
		},
		build: {
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (id.includes('maplibre-gl')) return 'vendor-maplibre';
						if (id.includes('mil-sym-ts')) return 'vendor-milsym';
						if (id.includes('xterm')) return 'vendor-xterm';
					}
				}
			}
		},
		optimizeDeps: {
			include: ['leaflet', 'cytoscape', 'mgrs']
		},
		ssr: {
			noExternal: ['mgrs']
		},
		define: {
			global: 'globalThis'
		}
	};
});
