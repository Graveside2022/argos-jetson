import { beforeEach, describe, expect, it } from 'vitest';

import {
	completeCompute,
	computeError,
	computeProgress,
	computeState,
	failCompute,
	isComputing,
	resetCompute,
	rfParams,
	startCompute,
	updateRFParam
} from './rf-propagation-store.svelte';

describe('rf-propagation-store (Phase 3 / ADR-0003 runes migration)', () => {
	beforeEach(() => resetCompute());

	it('updateRFParam updates a single parameter', () => {
		updateRFParam('frequency', 700);
		expect(rfParams.current.frequency).toBe(700);
	});

	it('startCompute marks computing + sets progress', () => {
		startCompute('go');
		expect(isComputing.current).toBe(true);
		expect(computeState.current).toBe('computing');
		expect(computeProgress.current).toBe('go');
	});

	it('failCompute sets error + clears computing', () => {
		failCompute('boom');
		expect(computeState.current).toBe('error');
		expect(computeError.current).toBe('boom');
		expect(isComputing.current).toBe(false);
	});

	it('completeCompute marks done + clears progress', () => {
		startCompute('go');
		completeCompute();
		expect(computeState.current).toBe('done');
		expect(computeProgress.current).toBe('');
	});

	it('resetCompute returns to idle', () => {
		failCompute('x');
		resetCompute();
		expect(computeState.current).toBe('idle');
		expect(computeError.current).toBeNull();
	});
});
