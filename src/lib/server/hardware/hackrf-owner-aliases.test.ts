import { describe, expect, test } from 'vitest';

import { canonicalizeWebRxOwner } from './hackrf-owner-aliases';

describe('canonicalizeWebRxOwner', () => {
	test('maps openwebrx-hackrf container → openwebrx canonical', () => {
		expect(canonicalizeWebRxOwner('openwebrx-hackrf')).toBe('openwebrx');
	});

	test('maps novasdr-hackrf container → novasdr canonical', () => {
		expect(canonicalizeWebRxOwner('novasdr-hackrf')).toBe('novasdr');
	});

	test('passes through canonical owner names unchanged', () => {
		expect(canonicalizeWebRxOwner('openwebrx')).toBe('openwebrx');
		expect(canonicalizeWebRxOwner('novasdr')).toBe('novasdr');
	});

	test('passes through unrelated owner names unchanged', () => {
		expect(canonicalizeWebRxOwner('kismet')).toBe('kismet');
		expect(canonicalizeWebRxOwner('random-tool')).toBe('random-tool');
	});

	test('passes through empty string unchanged', () => {
		expect(canonicalizeWebRxOwner('')).toBe('');
	});

	test('is case-sensitive — Openwebrx-HackRF does NOT map', () => {
		expect(canonicalizeWebRxOwner('Openwebrx-HackRF')).toBe('Openwebrx-HackRF');
	});
});
