// spec-024 PR1 T014 — Mk II UI state.
// `lsState()` is a localStorage-backed $state container — survives reload,
// SSR-safe (no DOM access at import time), JSON-encoded so primitives,
// arrays, and plain objects all work.
//
// Module-scope $state is fine because Svelte 5 schedules updates lazily; any
// component that reads `accentStore.value` opts into reactivity automatically.

export type AccentName = 'amber' | 'green' | 'cyan' | 'magenta' | 'steel';
export type Density = 'compact' | 'normal' | 'comfy';

export interface LsState<T> {
	value: T;
}

function readLs<T>(key: string): T | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? undefined : (JSON.parse(raw) as T);
	} catch {
		return undefined;
	}
}

function writeLs<T>(key: string, val: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(val));
	} catch {
		// quota exceeded / private mode — silent: state stays in memory only
	}
}

export function lsState<T>(key: string, initial: T): LsState<T> {
	let inner = $state<T>(readLs<T>(key) ?? initial);
	return {
		get value() {
			return inner;
		},
		set value(v: T) {
			inner = v;
			writeLs(key, v);
		}
	};
}

export const ACCENTS: AccentName[] = ['amber', 'green', 'cyan', 'magenta', 'steel'];
export const DENSITIES: Density[] = ['compact', 'normal', 'comfy'];

export const accentStore = lsState<AccentName>('argos.mk2.accent', 'amber');
export const densityStore = lsState<Density>('argos.mk2.density', 'normal');
