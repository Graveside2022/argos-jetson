import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { optimizeImports } from 'carbon-preprocess-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Preprocessors run in sequence — vitePreprocess (TS transpile) first, then
	// optimizeImports rewrites carbon-components-svelte barrel imports to source
	// paths (Carbon's documented optimization; carbon-preprocess-svelte README).
	preprocess: [vitePreprocess(), optimizeImports()],
	kit: {
		adapter: adapter(),
		files: {
			assets: 'static',
			hooks: {
				client: 'src/hooks.client',
				server: 'src/hooks.server'
			},
			lib: 'src/lib',
			params: 'src/params',
			routes: 'src/routes',
			serviceWorker: 'src/service-worker',
			appTemplate: 'src/app.html'
		}
	}
};

export default config;
