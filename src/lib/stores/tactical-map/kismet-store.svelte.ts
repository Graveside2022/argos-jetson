import type { KismetDevice } from '$lib/kismet/types';
import type { LeafletMarker } from '$lib/types/map';

export type DeviceClassification = 'friendly' | 'hostile' | 'unknown';

export interface KismetState {
	status: 'stopped' | 'starting' | 'running' | 'stopping';
	devices: Map<string, KismetDevice>;
	deviceMarkers: Map<string, LeafletMarker>;
	deviceCount: number;
	whitelistMAC: string;
	deviceAffiliations: Map<string, DeviceClassification>;
	message?: string; // Status message for agent context
	distributions: {
		byType: Map<string, number>;
		byManufacturer: Map<string, number>;
		byChannel: Map<string, number>;
	};
}

const initialKismetState: KismetState = {
	status: 'stopped',
	devices: new Map(),
	deviceMarkers: new Map(),
	deviceCount: 0,
	whitelistMAC: '',
	deviceAffiliations: new Map(),
	distributions: {
		byType: new Map(),
		byManufacturer: new Map(),
		byChannel: new Map()
	}
};

// $state.raw: state (and its Maps) is replaced wholesale on every mutation,
// never mutated in place — no deep proxy needed.
let kismetValue = $state.raw<KismetState>(initialKismetState);
export const kismetStore = {
	get current(): KismetState {
		return kismetValue;
	},
	set(value: KismetState): void {
		kismetValue = value;
	}
};

// Helper functions to update store
export const setKismetStatus = (status: 'stopped' | 'starting' | 'running' | 'stopping') => {
	kismetStore.set({ ...kismetStore.current, status });
};

export const setWhitelistMAC = (mac: string) => {
	kismetStore.set({ ...kismetStore.current, whitelistMAC: mac });
};

export const setDeviceAffiliation = (mac: string, affiliation: DeviceClassification) => {
	const state = kismetStore.current;
	const newAffiliations = new Map(state.deviceAffiliations);
	if (affiliation === 'unknown') {
		newAffiliations.delete(mac.toUpperCase());
	} else {
		newAffiliations.set(mac.toUpperCase(), affiliation);
	}
	kismetStore.set({ ...state, deviceAffiliations: newAffiliations });
};

export const clearAllKismetDevices = () => {
	kismetStore.set({
		...kismetStore.current,
		devices: new Map(),
		deviceMarkers: new Map(),
		deviceCount: 0,
		distributions: {
			byType: new Map(),
			byManufacturer: new Map(),
			byChannel: new Map()
		}
	});
};

/** Increment a counter in a Map. */
function incr(map: Map<string, number>, key: string): void {
	map.set(key, (map.get(key) || 0) + 1);
}

/** Tally device counts per a named field. */
function tallyField(
	devices: KismetDevice[],
	extract: (d: KismetDevice) => string
): Map<string, number> {
	const map = new Map<string, number>();
	for (const d of devices) incr(map, extract(d));
	return map;
}

/** Build distribution maps from a device collection. */
function buildDistributions(devices: KismetDevice[]) {
	return {
		byType: tallyField(devices, (d) => d.type || 'Unknown'),
		byManufacturer: tallyField(devices, (d) => d.manufacturer || 'Unknown'),
		byChannel: tallyField(devices, (d) => d.channel?.toString() || 'Unknown')
	};
}

/** Remove stale MACs from a device map. */
function pruneStale(
	existing: Map<string, KismetDevice>,
	incomingMACs: Set<string>
): Map<string, KismetDevice> {
	const result = new Map(existing);
	for (const mac of existing.keys()) {
		if (!incomingMACs.has(mac)) result.delete(mac);
	}
	return result;
}

/**
 * Batch-update all devices in a single store mutation.
 * Replaces per-device addKismetDevice() forEach loops that fire N individual updates.
 */
export const batchUpdateDevices = (
	incomingDevices: KismetDevice[],
	existingDevices: Map<string, KismetDevice>
) => {
	const newDevices = pruneStale(existingDevices, new Set(incomingDevices.map((d) => d.mac)));
	for (const device of incomingDevices) newDevices.set(device.mac, device);

	kismetStore.set({
		...kismetStore.current,
		devices: newDevices,
		deviceCount: newDevices.size,
		distributions: buildDistributions(incomingDevices)
	});
};
