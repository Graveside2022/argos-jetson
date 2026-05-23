import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// `browser` gates storage (SSR-safe) — mock it true. The global tests/setup.ts
// stubs localStorage with no-op vi.fn()s, so install a real Map-backed
// localStorage here to exercise actual round-trips. SUT imported dynamically
// after the mock so it applies.
vi.mock('$app/environment', () => ({ browser: true }));

const { loadPersisted, savePersisted } = await import('./persisted-storage');

beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => store.set(k, v),
		removeItem: (k: string) => store.delete(k),
		clear: () => store.clear()
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('persisted-storage (ADR-0003 load/save helpers)', () => {
	it('returns the default when nothing is stored', () => {
		expect(loadPersisted<number>('k', 42)).toBe(42);
	});

	it('loads + deserializes an existing value', () => {
		localStorage.setItem('k', JSON.stringify({ a: 1 }));
		expect(loadPersisted<{ a: number }>('k', { a: 0 }).a).toBe(1);
	});

	it('savePersisted serializes + writes', () => {
		savePersisted<string>('k', 'b');
		expect(localStorage.getItem('k')).toBe(JSON.stringify('b'));
	});

	it('Zod schema rejects a bad stored value → default', () => {
		localStorage.setItem('k', JSON.stringify('not-a-number'));
		expect(loadPersisted<number>('k', 7, { schema: z.number() })).toBe(7);
	});

	it('Zod schema accepts a valid stored value', () => {
		localStorage.setItem('k', JSON.stringify(99));
		expect(loadPersisted<number>('k', 7, { schema: z.number() })).toBe(99);
	});

	it('legacy validate returning null → default', () => {
		localStorage.setItem('k', JSON.stringify('bad'));
		expect(
			loadPersisted<string>('k', 'def', { validate: (v) => (v === 'good' ? v : null) })
		).toBe('def');
	});

	it('custom serialize/deserialize round-trips a Set', () => {
		const opts = {
			serialize: (v: Set<string>) => JSON.stringify([...v]),
			deserialize: (raw: string) => new Set(JSON.parse(raw) as string[])
		};
		savePersisted('k', new Set(['x', 'y']), opts);
		expect(localStorage.getItem('k')).toBe('["x","y"]');
		expect([...loadPersisted('k', new Set<string>(), opts)]).toEqual(['x', 'y']);
	});
});
