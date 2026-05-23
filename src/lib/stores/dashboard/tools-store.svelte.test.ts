import { beforeEach, describe, expect, it } from 'vitest';

import {
	breadcrumbs,
	currentCategory,
	navigateBack,
	navigateToCategory,
	toolNavigationPath
} from './tools-store.svelte';

describe('tools-store (Phase 3 / ADR-0003 runes migration)', () => {
	beforeEach(() => toolNavigationPath.set([]));

	it('starts at root: empty path, TOOLS breadcrumb, root category', () => {
		expect(toolNavigationPath.current).toEqual([]);
		expect(breadcrumbs.current).toEqual(['TOOLS']);
		expect('children' in currentCategory.current).toBe(true);
	});

	it('rejects navigation to an invalid category (path unchanged)', () => {
		navigateToCategory('definitely-not-a-real-category');
		expect(toolNavigationPath.current).toEqual([]);
	});

	it('navigateBack pops one level', () => {
		toolNavigationPath.set(['a', 'b']);
		navigateBack();
		expect(toolNavigationPath.current).toEqual(['a']);
	});

	it('navigateBack at root stays empty', () => {
		navigateBack();
		expect(toolNavigationPath.current).toEqual([]);
	});
});
