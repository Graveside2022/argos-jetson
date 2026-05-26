import { describe, expect, it } from 'vitest';

import { errMsg, normalizeError } from './error-utils';

describe('errMsg', () => {
	it('extracts message from Error instance', () => {
		expect(errMsg(new Error('something broke'))).toBe('something broke');
	});

	it('extracts message from TypeError', () => {
		expect(errMsg(new TypeError('cannot read property'))).toBe('cannot read property');
	});

	it('returns string values directly', () => {
		expect(errMsg('plain string error')).toBe('plain string error');
	});

	it('extracts message from object with message property', () => {
		expect(errMsg({ message: 'object error' })).toBe('object error');
	});

	it('stringifies null', () => {
		expect(errMsg(null)).toBe('null');
	});

	it('stringifies undefined', () => {
		expect(errMsg(undefined)).toBe('undefined');
	});

	it('stringifies numbers', () => {
		expect(errMsg(42)).toBe('42');
	});

	it('stringifies boolean', () => {
		expect(errMsg(false)).toBe('false');
	});

	it('stringifies objects without message property', () => {
		expect(errMsg({ code: 'ERR_TIMEOUT' })).toBe('[object Object]');
	});

	it('ignores non-string message properties', () => {
		expect(errMsg({ message: 123 })).toBe('[object Object]');
	});

	it('handles empty string', () => {
		expect(errMsg('')).toBe('');
	});
});

describe('normalizeError', () => {
	it('returns the same Error instance unchanged', () => {
		const original = new Error('original message');
		const result = normalizeError(original);
		expect(result).toBe(original); // strict identity, not just equal
	});

	it('preserves Error subclass identity', () => {
		const original = new TypeError('type error');
		const result = normalizeError(original);
		expect(result).toBe(original);
		expect(result).toBeInstanceOf(TypeError);
	});

	it('wraps a string in a new Error with that message', () => {
		const result = normalizeError('plain string err');
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe('plain string err');
	});

	it('wraps empty string in Error with empty message', () => {
		const result = normalizeError('');
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe('');
	});

	it('wraps null via String(err) coercion', () => {
		const result = normalizeError(null);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe('null');
	});

	it('wraps undefined via String(err) coercion', () => {
		const result = normalizeError(undefined);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe('undefined');
	});

	it('wraps a number via String(err) coercion', () => {
		const result = normalizeError(42);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe('42');
	});

	it('wraps an object via String(err) coercion', () => {
		const result = normalizeError({ code: 'ERR' });
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe('[object Object]');
	});

	it('does NOT wrap an Error in another Error (no double-wrap)', () => {
		const inner = new Error('inner');
		const outer = normalizeError(inner);
		expect(outer.message).toBe('inner'); // not '[Error: inner]'
		expect(outer).toBe(inner);
	});

	it('returns an Error (not undefined) for every input — branch coverage', () => {
		// Each branch should produce a non-undefined Error
		expect(normalizeError(new Error('a'))).toBeInstanceOf(Error);
		expect(normalizeError('b')).toBeInstanceOf(Error);
		expect(normalizeError(123)).toBeInstanceOf(Error);
	});

	it('result.message is always a string (never undefined)', () => {
		expect(typeof normalizeError(new Error('x')).message).toBe('string');
		expect(typeof normalizeError('y').message).toBe('string');
		expect(typeof normalizeError(0).message).toBe('string');
	});
});
