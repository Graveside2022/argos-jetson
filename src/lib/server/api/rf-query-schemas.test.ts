import { describe, expect, it } from 'vitest';

import { BBoxSchema, CsvListSchema, IntSchema } from './rf-query-schemas';

describe('BBoxSchema', () => {
	it('parses valid bbox into [minLon, minLat, maxLon, maxLat]', () => {
		const result = BBoxSchema.parse('-122.5,37.7,-122.3,37.9');
		expect(result).toEqual([-122.5, 37.7, -122.3, 37.9]);
	});

	it('accepts integer coordinates', () => {
		expect(BBoxSchema.parse('-180,-90,180,90')).toEqual([-180, -90, 180, 90]);
	});

	it('accepts coordinates with whitespace', () => {
		expect(BBoxSchema.parse(' -122.5 , 37.7 , -122.3 , 37.9 ')).toEqual([
			-122.5, 37.7, -122.3, 37.9
		]);
	});

	it('rejects wrong number of parts (3)', () => {
		const result = BBoxSchema.safeParse('-122.5,37.7,-122.3');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				'bbox must be "minLon,minLat,maxLon,maxLat"'
			);
			// Exact code='custom' assertion — kills StringLiteral '""' mutant on L35
			expect(result.error.issues[0].code).toBe('custom');
		}
	});

	it('rejects wrong number of parts (5)', () => {
		const result = BBoxSchema.safeParse('-122.5,37.7,-122.3,37.9,0');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				'bbox must be "minLon,minLat,maxLon,maxLat"'
			);
		}
	});

	it('rejects non-numeric parts', () => {
		const result = BBoxSchema.safeParse('foo,bar,baz,qux');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				'bbox must be "minLon,minLat,maxLon,maxLat"'
			);
		}
	});

	it('rejects Infinity', () => {
		const result = BBoxSchema.safeParse('Infinity,0,1,1');
		expect(result.success).toBe(false);
	});

	it('rejects NaN', () => {
		const result = BBoxSchema.safeParse('NaN,0,1,1');
		expect(result.success).toBe(false);
	});

	it('rejects minLat below -90', () => {
		const result = BBoxSchema.safeParse('-122,-91,-121,37');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				'bbox coordinates out of range or inverted'
			);
			// Exact code='custom' assertion — kills StringLiteral '""' mutant on L40
			expect(result.error.issues[0].code).toBe('custom');
		}
	});

	it('rejects maxLat above 90', () => {
		const result = BBoxSchema.safeParse('-122,37,-121,91');
		expect(result.success).toBe(false);
	});

	it('rejects minLon below -180', () => {
		const result = BBoxSchema.safeParse('-181,37,-121,38');
		expect(result.success).toBe(false);
	});

	it('rejects maxLon above 180', () => {
		const result = BBoxSchema.safeParse('-122,37,181,38');
		expect(result.success).toBe(false);
	});

	it('rejects inverted lat ordering (minLat == maxLat)', () => {
		const result = BBoxSchema.safeParse('-122,37,-121,37');
		expect(result.success).toBe(false);
	});

	it('rejects inverted lat ordering (minLat > maxLat)', () => {
		const result = BBoxSchema.safeParse('-122,38,-121,37');
		expect(result.success).toBe(false);
	});

	it('rejects inverted lon ordering (minLon == maxLon)', () => {
		const result = BBoxSchema.safeParse('-122,37,-122,38');
		expect(result.success).toBe(false);
	});

	it('rejects inverted lon ordering (minLon > maxLon)', () => {
		const result = BBoxSchema.safeParse('-121,37,-122,38');
		expect(result.success).toBe(false);
	});

	it('accepts bbox at exact -90/90 lat boundary', () => {
		expect(BBoxSchema.parse('-180,-90,180,90')).toEqual([-180, -90, 180, 90]);
	});

	it('rejects empty string', () => {
		const result = BBoxSchema.safeParse('');
		expect(result.success).toBe(false);
	});
});

describe('CsvListSchema', () => {
	it('splits comma-separated values', () => {
		expect(CsvListSchema.parse('a,b,c')).toEqual(['a', 'b', 'c']);
	});

	it('trims whitespace around each value', () => {
		expect(CsvListSchema.parse(' a , b , c ')).toEqual(['a', 'b', 'c']);
	});

	it('drops empty values (consecutive commas)', () => {
		expect(CsvListSchema.parse('a,,b')).toEqual(['a', 'b']);
	});

	it('drops leading/trailing empty values', () => {
		expect(CsvListSchema.parse(',a,b,')).toEqual(['a', 'b']);
	});

	it('drops whitespace-only values', () => {
		expect(CsvListSchema.parse('a, ,b')).toEqual(['a', 'b']);
	});

	it('returns single-element array for no commas', () => {
		expect(CsvListSchema.parse('solo')).toEqual(['solo']);
	});

	it('returns empty array for empty string', () => {
		expect(CsvListSchema.parse('')).toEqual([]);
	});

	it('returns empty array for all-whitespace string', () => {
		expect(CsvListSchema.parse('   ')).toEqual([]);
	});

	it('preserves order', () => {
		expect(CsvListSchema.parse('z,a,m')).toEqual(['z', 'a', 'm']);
	});
});

describe('IntSchema', () => {
	it('parses positive integer', () => {
		expect(IntSchema.parse('42')).toBe(42);
	});

	it('parses negative integer', () => {
		expect(IntSchema.parse('-42')).toBe(-42);
	});

	it('parses zero', () => {
		expect(IntSchema.parse('0')).toBe(0);
	});

	it('parses multi-digit values', () => {
		expect(IntSchema.parse('1234567')).toBe(1234567);
	});

	it('rejects decimal', () => {
		expect(() => IntSchema.parse('1.5')).toThrow();
	});

	it('rejects scientific notation', () => {
		expect(() => IntSchema.parse('1e5')).toThrow();
	});

	it('rejects hex', () => {
		expect(() => IntSchema.parse('0x10')).toThrow();
	});

	it('rejects letters', () => {
		expect(() => IntSchema.parse('abc')).toThrow();
	});

	it('rejects empty string', () => {
		expect(() => IntSchema.parse('')).toThrow();
	});

	it('rejects whitespace-padded', () => {
		expect(() => IntSchema.parse(' 42 ')).toThrow();
	});

	it('rejects plus sign prefix', () => {
		expect(() => IntSchema.parse('+42')).toThrow();
	});

	it('returns number type, not string', () => {
		const result = IntSchema.parse('42');
		expect(typeof result).toBe('number');
	});
});
