import { describe, expect, it } from 'vitest';

import { signalDesignator } from './signal-designator';

describe('signalDesignator', () => {
	it('formats hackrf 2.4 GHz signal', () => {
		expect(signalDesignator('hackrf', 2412, 'a3f1deadbeef')).toBe('HAC·2412·beef');
	});

	it('uppercases source and truncates to 3 chars', () => {
		expect(signalDesignator('kismet', 5180, 'shortid')).toBe('KIS·5180·rtid');
	});

	it('passes through 3-char source', () => {
		expect(signalDesignator('hrf', 433, 'abc12345')).toBe('HRF·433·2345');
	});

	it('rounds non-integer frequency', () => {
		expect(signalDesignator('rtl', 162.025, 'xyzwabcd')).toBe('RTL·162·abcd');
	});

	it('lowercases id tail', () => {
		expect(signalDesignator('blu', 2402, 'BCDE71DE')).toBe('BLU·2402·71de');
	});

	it('returns null when source missing', () => {
		expect(signalDesignator('', 2412, 'abcd')).toBeNull();
		expect(signalDesignator(null, 2412, 'abcd')).toBeNull();
		expect(signalDesignator(undefined, 2412, 'abcd')).toBeNull();
	});

	it('returns null when frequency missing or invalid', () => {
		expect(signalDesignator('hrf', null, 'abcd')).toBeNull();
		expect(signalDesignator('hrf', undefined, 'abcd')).toBeNull();
		expect(signalDesignator('hrf', 0, 'abcd')).toBeNull();
		expect(signalDesignator('hrf', -100, 'abcd')).toBeNull();
		expect(signalDesignator('hrf', Number.NaN, 'abcd')).toBeNull();
		expect(signalDesignator('hrf', Number.POSITIVE_INFINITY, 'abcd')).toBeNull();
	});

	it('returns null when signal id missing', () => {
		expect(signalDesignator('hrf', 2412, '')).toBeNull();
		expect(signalDesignator('hrf', 2412, null)).toBeNull();
		expect(signalDesignator('hrf', 2412, undefined)).toBeNull();
	});

	it('handles 1-char source by padding upper-case', () => {
		expect(signalDesignator('h', 100, 'wxyz')).toBe('H·100·wxyz');
	});

	it('handles signal id shorter than 4 chars', () => {
		expect(signalDesignator('blu', 2402, 'ab')).toBe('BLU·2402·ab');
	});

	it('rounds 0.5 frequency to 1', () => {
		expect(signalDesignator('hrf', 0.5, 'abcd')).toBe('HRF·1·abcd');
	});
});
