/**
 * Persisted writable store — wraps Svelte's writable with automatic localStorage sync.
 * Eliminates manual .subscribe() calls for persistence.
 */
import { type Writable, writable } from 'svelte/store';
import type { ZodType } from 'zod';

import { browser } from '$app/environment';

interface PersistedWritableOptions<T> {
	/** Custom serializer (default: JSON.stringify) */
	serialize?: (value: T) => string;
	/** Custom deserializer (default: JSON.parse) */
	deserialize?: (raw: string) => T;
	/**
	 * Zod schema — preferred validation path. Returned value is `schema.safeParse(parsed).data`
	 * on success, falling back to `defaultValue` on failure. Supersedes the legacy `validate` shim.
	 */
	schema?: ZodType<T>;
	/**
	 * Transform/validate the deserialized value; return null to use defaultValue.
	 * @deprecated Prefer `schema` with a `ZodType<T>`. Kept for callers that need
	 * arbitrary post-deserialize transforms (e.g. merging defaults into a partial object).
	 */
	validate?: (value: T) => T | null;
}

/** Normalized validator signature: `(parsed) => value-or-null`. */
type Validator<T> = (parsed: unknown) => T | null;

/** Pick whichever validation path the caller specified (schema wins over legacy validate). */
function buildValidator<T>(options?: PersistedWritableOptions<T>): Validator<T> | undefined {
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

/** Apply optional validation, returning defaultValue on null. */
function applyValidation<T>(
	parsed: unknown,
	validator: Validator<T> | undefined,
	defaultValue: T
): T {
	if (!validator) return parsed as T;
	const validated = validator(parsed);
	return validated !== null ? validated : defaultValue;
}

/** Load a value from localStorage with deserialization and validation. */
function loadFromStorage<T>(
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

/** Persist a serialized value to localStorage. */
function saveToStorage<T>(key: string, value: T, serialize: (v: T) => string): void {
	try {
		const serialized = serialize(value);
		if (serialized === 'null') localStorage.removeItem(key);
		else localStorage.setItem(key, serialized);
	} catch {
		// localStorage full or unavailable — silently ignore
	}
}

/** Resolve serializer from options, defaulting to JSON.stringify. */
function resolveSerializer<T>(options?: PersistedWritableOptions<T>): (value: T) => string {
	return options?.serialize ?? JSON.stringify;
}

/** Resolve deserializer from options, defaulting to JSON.parse. */
function resolveDeserializer<T>(options?: PersistedWritableOptions<T>): (raw: string) => T {
	return options?.deserialize ?? JSON.parse;
}

/**
 * Creates a writable store that persists to localStorage.
 *
 * - Reads initial value from localStorage (falling back to defaultValue on parse error)
 * - Writes every change back to localStorage
 * - SSR-safe: returns defaultValue on server
 *
 * @param key - localStorage key
 * @param defaultValue - fallback when nothing is stored or parse fails
 * @param options - custom serialize/deserialize + Zod schema (preferred) or legacy validate
 */
export function persistedWritable<T>(
	key: string,
	defaultValue: T,
	options?: PersistedWritableOptions<T>
): Writable<T> {
	const serialize = resolveSerializer(options);
	const deserialize = resolveDeserializer(options);
	const validator = buildValidator(options);
	const store = writable<T>(loadFromStorage(key, defaultValue, deserialize, validator));
	if (browser) store.subscribe((value) => saveToStorage(key, value, serialize));
	return store;
}
