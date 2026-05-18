/**
 * V3 Theme Store — appearance state for the NVIDIA-themed UI on port 5175.
 *
 * Manages two axes: colour mode (light/dark) and accent palette. Kept
 * deliberately SEPARATE from the shared `theme-store.svelte.ts` so the V1
 * (:5173) and V2 (:5174) UIs are never affected by V3 — that store adds the
 * `.dark` class to <html> unconditionally; this one never touches it.
 *
 * Persistence: localStorage key `argos-v3-theme` (distinct from V1/V2's
 * `argos-theme`). DOM: stamps `data-ui="v3"`, `data-mode`, `data-palette`
 * on <body> — the same element Mk II uses for `data-ui="mk2"`. V3's
 * light/dark is driven entirely by `[data-mode]`, so the stale
 * `<html class="dark">` in app.html is irrelevant to the `[data-ui='v3']`
 * CSS scope.
 */

import { browser } from '$app/environment';

export type V3Mode = 'light' | 'dark';

/** `nvidia` (green — the default) plus the 13 shared MIL-STD palettes. */
export type V3Palette =
	| 'nvidia'
	| 'ash'
	| 'blue'
	| 'blush'
	| 'iron'
	| 'iris'
	| 'khaki'
	| 'mauve'
	| 'pewter'
	| 'plum'
	| 'rose'
	| 'sand'
	| 'silver'
	| 'violet';

interface V3ThemeState {
	mode: V3Mode;
	palette: V3Palette;
}

const STORAGE_KEY = 'argos-v3-theme';

/** NVIDIA's primary surface is the white canvas, so light is the default. */
const DEFAULT_STATE: V3ThemeState = {
	mode: 'light',
	palette: 'nvidia'
};

const VALID_MODES: V3Mode[] = ['light', 'dark'];

const VALID_PALETTES: V3Palette[] = [
	'nvidia',
	'ash',
	'blue',
	'blush',
	'iron',
	'iris',
	'khaki',
	'mauve',
	'pewter',
	'plum',
	'rose',
	'sand',
	'silver',
	'violet'
];

/** Validate a parsed theme state against allowed values, falling back to defaults. */
function validateParsed(parsed: Record<string, unknown>): V3ThemeState {
	const mode = parsed.mode as V3Mode;
	const palette = parsed.palette as V3Palette;
	return {
		mode: VALID_MODES.includes(mode) ? mode : DEFAULT_STATE.mode,
		palette: VALID_PALETTES.includes(palette) ? palette : DEFAULT_STATE.palette
	};
}

function loadState(): V3ThemeState {
	if (!browser) return { ...DEFAULT_STATE };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? validateParsed(JSON.parse(raw)) : { ...DEFAULT_STATE };
	} catch {
		return { ...DEFAULT_STATE };
	}
}

function saveState(state: V3ThemeState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// QuotaExceededError or other storage failure — silently ignore
	}
}

/** Stamp `data-ui`/`data-mode`/`data-palette` on <body>. Idempotent. */
function applyState(state: V3ThemeState): void {
	if (!browser) return;
	const body = document.body;
	body.dataset.ui = 'v3';
	body.dataset.mode = state.mode;
	body.dataset.palette = state.palette;
}

function createV3ThemeStore() {
	let state = $state<V3ThemeState>(loadState());

	// Re-assert on the client after the inline FOUC script in app.html has
	// already stamped the attributes pre-paint — keeps store and DOM in sync.
	if (browser) applyState(state);

	return {
		get mode() {
			return state.mode;
		},
		get palette() {
			return state.palette;
		},

		setMode(mode: V3Mode) {
			if (!VALID_MODES.includes(mode)) return;
			state.mode = mode;
			applyState(state);
			saveState(state);
		},

		toggleMode() {
			const next: V3Mode = state.mode === 'light' ? 'dark' : 'light';
			state.mode = next;
			applyState(state);
			saveState(state);
		},

		setPalette(palette: V3Palette) {
			if (!VALID_PALETTES.includes(palette)) return;
			state.palette = palette;
			applyState(state);
			saveState(state);
		}
	};
}

export const v3ThemeStore = createV3ThemeStore();
