/**
 * Tools navigation store for hierarchical tool organization.
 *
 * Phase 3 / ADR-0003: migrated from `svelte/store` (`persistedWritable` +
 * `derived`) to the rune state layer. Navigation path is a `persistedState`;
 * `currentCategory`/`breadcrumbs` are read-only getter accessors that recompute
 * reactively from `navPath.current` (the module-`$state` read is tracked).
 */

import { findByPath, toolHierarchy } from '$lib/data/tool-hierarchy';
import { persistedState } from '$lib/state/persisted.svelte';

// Navigation state: stack of category IDs representing the path.
// [] = root (TOOLS), ['offnet'] = OFFNET, ['offnet','recon'] = RECON.
const navPath = persistedState<string[]>('toolNavigationPath', [], {
	validate: (stored) => {
		if (stored.length === 0) return stored;
		const result = findByPath(stored, toolHierarchy.root);
		return result && 'children' in result ? stored : null;
	}
});

/** Reactive navigation path + setter (replaces the writable's `$`/`.set`). */
export const toolNavigationPath = {
	get current() {
		return navPath.current;
	},
	set(path: string[]) {
		navPath.set(path);
	}
};

/** Current category being viewed (derived from the navigation path). */
export const currentCategory = {
	get current() {
		const path = navPath.current;
		if (path.length === 0) return toolHierarchy.root;
		const result = findByPath(path, toolHierarchy.root);
		return result && 'children' in result ? result : toolHierarchy.root;
	}
};

/** Breadcrumb trail for the navigation header (derived from the path). */
export const breadcrumbs = {
	get current() {
		const crumbs: string[] = ['TOOLS'];
		let current = toolHierarchy.root;
		for (const id of navPath.current) {
			const found = current.children.find((child) => child.id === id);
			if (found && 'children' in found) {
				crumbs.push(found.name);
				current = found;
			}
		}
		return crumbs;
	}
};

/** Navigate to a category by ID; commits only if the target path is valid. */
export function navigateToCategory(categoryId: string): void {
	const newPath = [...navPath.current, categoryId];
	const result = findByPath(newPath, toolHierarchy.root);
	if (result && 'children' in result) navPath.set(newPath);
}

/** Navigate back one level in the hierarchy. */
export function navigateBack(): void {
	navPath.set(navPath.current.slice(0, -1));
}
