import { describe, expect, it } from 'vitest';

import type { KismetDevice } from '$lib/kismet/types';

import {
	batchUpdateDevices,
	clearAllKismetDevices,
	kismetStore,
	setDeviceAffiliation,
	setKismetStatus
} from './kismet-store.svelte';

const dev = (mac: string): KismetDevice => ({ mac, type: 'Wi-Fi' }) as KismetDevice;

describe('kismet-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('defaults to stopped with empty maps', () => {
		clearAllKismetDevices();
		setKismetStatus('stopped');
		expect(kismetStore.current.status).toBe('stopped');
		expect(kismetStore.current.devices.size).toBe(0);
	});

	it('setKismetStatus updates status', () => {
		setKismetStatus('running');
		expect(kismetStore.current.status).toBe('running');
	});

	it('batchUpdateDevices replaces the device map + count + distributions', () => {
		batchUpdateDevices([dev('AA'), dev('BB')], kismetStore.current.devices);
		expect(kismetStore.current.devices.size).toBe(2);
		expect(kismetStore.current.deviceCount).toBe(2);
		expect(kismetStore.current.distributions.byType.get('Wi-Fi')).toBe(2);
	});

	it('setDeviceAffiliation sets and clears affiliations (uppercased)', () => {
		setDeviceAffiliation('aa', 'hostile');
		expect(kismetStore.current.deviceAffiliations.get('AA')).toBe('hostile');
		setDeviceAffiliation('aa', 'unknown');
		expect(kismetStore.current.deviceAffiliations.has('AA')).toBe(false);
	});
});
