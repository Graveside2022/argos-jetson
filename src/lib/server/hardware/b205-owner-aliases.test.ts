import { describe, expect, it } from 'vitest';

import { canonicalizeB205Owner } from './b205-owner-aliases';

describe('canonicalizeB205Owner', () => {
	it('maps gnuradio-companion to gnu-radio-vnc', () => {
		expect(canonicalizeB205Owner('gnuradio-companion')).toBe('gnu-radio-vnc');
	});

	it('maps blue-dragon binary to bluedragon canonical owner', () => {
		expect(canonicalizeB205Owner('blue-dragon')).toBe('bluedragon');
	});

	it('maps fpv_energy_scan.py to wardragon-fpv-detect', () => {
		expect(canonicalizeB205Owner('fpv_energy_scan.py')).toBe('wardragon-fpv-detect');
	});

	it('maps fpv_energy_scan (no .py) to wardragon-fpv-detect', () => {
		expect(canonicalizeB205Owner('fpv_energy_scan')).toBe('wardragon-fpv-detect');
	});

	it('returns gnss-sdr unchanged — canonical owner constant already matches', () => {
		expect(canonicalizeB205Owner('gnss-sdr')).toBe('gnss-sdr');
	});

	it('returns canonical owners unchanged (idempotent)', () => {
		expect(canonicalizeB205Owner('bluedragon')).toBe('bluedragon');
		expect(canonicalizeB205Owner('gnu-radio-vnc')).toBe('gnu-radio-vnc');
		expect(canonicalizeB205Owner('wardragon-fpv-detect')).toBe('wardragon-fpv-detect');
	});

	it('returns UHD diagnostic utilities unchanged (no canonical owner)', () => {
		expect(canonicalizeB205Owner('uhd_find_devices')).toBe('uhd_find_devices');
		expect(canonicalizeB205Owner('uhd_usrp_probe')).toBe('uhd_usrp_probe');
		expect(canonicalizeB205Owner('uhd_fft')).toBe('uhd_fft');
		expect(canonicalizeB205Owner('rx_samples_to_file')).toBe('rx_samples_to_file');
	});

	it('returns truly unknown owners unchanged', () => {
		expect(canonicalizeB205Owner('random-process')).toBe('random-process');
		expect(canonicalizeB205Owner('')).toBe('');
	});
});
