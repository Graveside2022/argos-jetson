/**
 * Pure localStorage load/save helpers for `persistedState` (ADR-0003).
 *
 * Framework-agnostic + SSR-safe (gated on `browser`). Kept in a plain `.ts`
 * module — separate from the rune wrapper in `persisted.svelte.ts` — so the
 * serialize/deserialize/schema/validate logic is unit-testable.
 */

import type { ZodType } from 'zod';

import { browser } from '$app/environment';

export interface PersistedStorageOptions<T> {
	/** Custom serializer (default: JSON.stringify). */
	serialize?: (value: T) => string;
	/** Custom deserializer (default: JSON.parse). */
	deserialize?: (raw: string) => T;
	/** Zod schema — preferred validation path; falls back to defaultValue on failure. */
	schema?: ZodType<T>;
	/** Legacy transform/validate; return null to use defaultValue. Prefer `schema`. */
	validate?: (value: T) => T | null;
}

type Validator<T> = (parsed: unknown) => T | null;

function buildValidator<T>(options?: PersistedStorageOptions<T>): Validator<T> | undefined {
	if (options?.schema) {
		const schema = options.schema;
		return (parsed) => {
			const result = schema.safeParse(parsed);
			return result.success ? result.data : null;
		};
	}
	if (options?.validate) {
		const validate = options.validate;
		return (parsed) => validate(parsed as T);
	}
	return undefined;
}

function applyValidation<T>(
	parsed: unknown,
	validator: Validator<T> | undefined,
	defaultValue: T
): T {
	if (!validator) return parsed as T;
	const validated = validator(parsed);
	return validated !== null ? validated : defaultValue;
}

function resolveDeserializer<T>(options?: PersistedStorageOptions<T>): (raw: string) => T {
	return options?.deserialize ?? JSON.parse;
}

function resolveSerializer<T>(options?: PersistedStorageOptions<T>): (value: T) => string {
	return options?.serialize ?? JSON.stringify;
}

function readStorage<T>(
	key: string,
	defaultValue: T,
	deserialize: (raw: string) => T,
	validator: Validator<T> | undefined
): T {
	if (!browser) return defaultValue;
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return defaultValue;
		return applyValidation(deserialize(raw), validator, defaultValue);
	} catch {
		return defaultValue;
	}
}

function writeStorage<T>(key: string, value: T, serialize: (v: T) => string): void {
	if (!browser) return;
	try {
		const serialized = serialize(value);
		if (serialized === 'null') localStorage.removeItem(key);
		else localStorage.setItem(key, serialized);
	} catch {
		// localStorage full or unavailable — silently ignore
	}
}

/** Load + deserialize + validate a value from localStorage; defaultValue on miss/error/SSR. */
export function loadPersisted<T>(
	key: string,
	defaultValue: T,
	options?: PersistedStorageOptions<T>
): T {
	return readStorage(key, defaultValue, resolveDeserializer(options), buildValidator(options));
}

/** Serialize + persist a value to localStorage; no-op on SSR or storage failure. */
export function savePersisted<T>(key: string, value: T, options?: PersistedStorageOptions<T>): void {
	writeStorage(key, value, resolveSerializer(options));
}
