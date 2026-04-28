import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';

export default [
	js.configs.recommended,
	{
		ignores: [
			'node_modules/**',
			'build/**',
			'.svelte-kit/**',
			'.next/**',
			'package/**',
			'**/.venv/**',
			'**/venv/**',
			'**/dist/**',
			'service/dist/**',
			'.env',
			'.env.*',
			'!.env.example',
			'vite.config.js.timestamp-*',
			'vite.config.ts.timestamp-*',
			'hackrfbackup.svelte',
			'tests/reports/**',
			'tests/reports/**/*.js',
			'data/reports/**',
			'playwright-report/**',
			'static/webtak/**',
			// Quarto-generated report artifacts (revealjs, katex, highlight,
			// etc.) land in data/reports/ and include thousands of vendor JS
			// files that ESLint shouldn't scan. The whole data/ tree is
			// gitignored already; this mirrors that for the linter.
			'data/**',
			// Spec 026 reference docs cloned under docs/ (argos-v2-mockup,
			// carbon-design-system, carbon-website). All gitignored; mirror
			// here so ESLint doesn't scan thousands of vendor JSX/JS files
			// from Carbon and the v2 mockup.
			'docs/argos-v2-mockup/**',
			'docs/carbon-design-system/**',
			'docs/carbon-website/**'
		]
	},
	{
		files: ['**/*.js', '**/*.ts', '**/*.svelte'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2022,
				NodeJS: 'readonly'
			}
		},
		plugins: {
			'simple-import-sort': simpleImportSort
		},
		rules: {
			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			],
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error'
		}
	},
	{
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			globals: {
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly',
				$host: 'readonly'
			}
		}
	},
	{
		files: ['**/*.ts', '**/*.svelte'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: false, // Disable type checking for performance
				ecmaVersion: 2022,
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': ts,
			sonarjs
		},
		rules: {
			...ts.configs.recommended.rules, // Use non-type-checked rules
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			],
			'@typescript-eslint/no-explicit-any': 'warn', // Enforce proper typing
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn', // Prefer type guards
			'no-console': ['warn', { allow: ['warn', 'error'] }], // Use proper logging
			complexity: ['error', 5], // Cyclomatic complexity — hard block, no exceptions
			'sonarjs/cognitive-complexity': ['error', 5] // Cognitive complexity — hard block, no exceptions
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser
			}
		},
		plugins: {
			svelte
		},
		rules: {
			...svelte.configs.recommended.rules
		}
	},
	{
		files: ['**/*.cjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
			globals: {
				...globals.node
			}
		},
		rules: {
			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			]
		}
	},
	{
		files: ['**/*.mjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.node
			}
		}
	},
	{
		// Production code under src/ must not use the `!` non-null assertion.
		// Tests/scripts stay at the global 'warn' level (mocking + setup code
		// legitimately uses `!` for type narrowing on known-safe values).
		files: ['src/**/*.{js,ts,svelte}'],
		rules: {
			'@typescript-eslint/no-non-null-assertion': 'error'
		}
	},
	{
		// Architectural boundaries (eslint-plugin-boundaries v6).
		// Mirrors .sentrux/rules.toml layer ordering + the 3 client→server
		// hard boundaries. Sentrux Free tier caps check_rules at 3 simultaneous
		// rules, so we trim sentrux to max_cycles=0 + 2 boundaries and let
		// ESLint enforce the rest at lint time (uncapped, fires on every
		// commit via husky). The architectural fitness tests in
		// tests/architecture/ are the comprehensive third tier.
		files: ['src/**/*.{js,ts,svelte}'],
		plugins: {
			boundaries
		},
		settings: {
			'boundaries/elements': [
				{ type: 'route', pattern: 'src/routes/**' },
				{ type: 'component', pattern: 'src/lib/components/**' },
				{ type: 'state', pattern: ['src/lib/stores/**', 'src/lib/state/**'] },
				{ type: 'server', pattern: 'src/lib/server/**' },
				{ type: 'util', pattern: 'src/lib/utils/**' },
				{ type: 'type', pattern: ['src/lib/types/**', 'src/lib/schemas/**'] }
			],
			'boundaries/include': ['src/**/*.{js,ts,svelte}'],
			'boundaries/ignore': ['**/*.{test,spec}.{js,ts}', 'src/lib/server/mcp/**']
		},
		rules: {
			'boundaries/dependencies': [
				'error',
				{
					default: 'allow',
					rules: [
						{
							from: { type: 'component' },
							disallow: { to: { type: 'server' } },
							message:
								'Components must call /api endpoints, never import server modules directly'
						},
						{
							from: { type: 'state' },
							disallow: { to: { type: 'server' } },
							message:
								'Stores/state must call /api endpoints, never import server modules directly'
						},
						{
							from: { type: 'state' },
							disallow: { to: { type: 'component' } },
							message:
								'state must not import from components (inverted layer direction)'
						},
						{
							from: { type: 'type' },
							disallow: { to: { type: ['state', 'component', 'server'] } },
							message: 'types must be leaves — no imports of state/components/server'
						},
						{
							from: { type: 'util' },
							disallow: { to: { type: ['state', 'component', 'server'] } },
							message: 'utils must not import from state/components/server'
						}
					]
				}
			]
		}
	},
	prettier
];
