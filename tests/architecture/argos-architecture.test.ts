// Argos architectural fitness functions, enforced via ArchUnitTS.
//
// These rules complement (do NOT replace) two other layers:
//   - Sentrux check_rules — runs on every PR via session_start/session_end
//     bracketing; capped at 3 simultaneous rules in Free tier.
//   - eslint-plugin-boundaries — enforces layer-direction at lint time;
//     fires on every commit via husky pre-commit.
//
// The tests below are the "comprehensive" tier: they run via vitest in CI
// + locally via `npm run test:unit`. Failures here block merge.
//
// Layer ordering (matches .sentrux/rules.toml + eslint-plugin-boundaries
// settings; lower order = trunk, higher order = leaf):
//   routes (0) → components (1) → state (2) → server (3) → utils (4) → types (5)

import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';

// Acyclicity is enforced by sentrux check_rules (max_cycles=0 in
// .sentrux/rules.toml) which is faster than ArchUnitTS on a 1600+ file
// codebase. Sentrux is also bracketed per-PR via session_start/session_end
// so cycles are caught immediately. ArchUnitTS focuses on the layer +
// boundary rules below where it adds defense-in-depth without speed cost.

describe('Argos architectural fitness functions', () => {
	describe('Layer direction (lower-order may import higher-order, never reverse)', () => {
		it('types/ must be leaves (no imports of state/stores/components/server/utils)', async () => {
			const rule = projectFiles()
				.inFolder('src/lib/types/**')
				.shouldNot()
				.dependOnFiles()
				.inPath('src/lib/{state,stores,components,server,utils}/**');
			await expect(rule).toPassAsync();
		});

		it('utils/ must not depend on state/stores/components/server', async () => {
			const rule = projectFiles()
				.inFolder('src/lib/utils/**')
				.shouldNot()
				.dependOnFiles()
				.inPath('src/lib/{state,stores,components,server}/**');
			await expect(rule).toPassAsync();
		});

		it('state/ + stores/ must not depend on components', async () => {
			const rule = projectFiles()
				.inPath('src/lib/{state,stores}/**')
				.shouldNot()
				.dependOnFiles()
				.inFolder('src/lib/components/**');
			await expect(rule).toPassAsync();
		});
	});

	describe('Network boundary (browser code must hit /api, never import server)', () => {
		it('components/ must not import server/ directly', async () => {
			const rule = projectFiles()
				.inFolder('src/lib/components/**')
				.shouldNot()
				.dependOnFiles()
				.inFolder('src/lib/server/**');
			await expect(rule).toPassAsync();
		});

		it('state/ must not import server/ directly', async () => {
			const rule = projectFiles()
				.inFolder('src/lib/state/**')
				.shouldNot()
				.dependOnFiles()
				.inFolder('src/lib/server/**');
			await expect(rule).toPassAsync();
		});

		it('stores/ must not import server/ directly', async () => {
			const rule = projectFiles()
				.inFolder('src/lib/stores/**')
				.shouldNot()
				.dependOnFiles()
				.inFolder('src/lib/server/**');
			await expect(rule).toPassAsync();
		});
	});

	describe('Production bundle hygiene', () => {
		it('routes/ must not import test fixtures', async () => {
			const rule = projectFiles()
				.inFolder('src/routes/**')
				.shouldNot()
				.dependOnFiles()
				.inFolder('tests/**');
			await expect(rule).toPassAsync();
		});
	});
});
