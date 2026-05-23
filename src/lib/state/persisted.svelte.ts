/**
 * persistedState — the canonical rune-based localStorage-backed reactive value.
 *
 * Replaces the legacy `svelte/store`-based `persistedWritable` (ADR-0003: one
 * rune state layer). Same feature set — custom serialize/deserialize, Zod
 * schema (preferred), or legacy `validate` — but exposes universal reactivity
 * (`.current` getter + `.set()`) instead of the store contract.
 *
 * Persistence is wholesale (the value is replaced via `set()`, never deeply
 * mutated), so `$state.raw` is used and saving happens in the setter — no
 * `$effect` needed. The pure load/save logic lives in `persisted-storage.ts`.
 */

import { loadPersisted, type PersistedStorageOptions, savePersisted } from './persisted-storage';

export type PersistedStateOptions<T> = PersistedStorageOptions<T>;

export interface PersistedState<T> {
	/** Current reactive value. */
	readonly current: T;
	/** Replace the value and persist it. */
	set(value: T): void;
}

/**
 * Create a localStorage-backed reactive value.
 *
 * @param key - localStorage key
 * @param defaultValue - fallback when nothing is stored or parse/validation fails
 * @param options - custom serialize/deserialize + Zod schema (preferred) or legacy validate
 */
export function persistedState<T>(
	key: string,
	defaultValue: T,
	options?: PersistedStateOptions<T>
): PersistedState<T> {
	let value = $state.raw<T>(loadPersisted(key, defaultValue, options));

	return {
		get current() {
			return value;
		},
		set(next: T) {
			value = next;
			savePersisted(key, next, options);
		}
	};
}
