export interface Detection {
	signalId: string;
	designator: string | null;
	source: string;
	frequencyMHz: number;
	bearingDeg: number | null;
	distanceM: number | null;
	rssiDbm: number;
	confidence: number | null;
	sampleCount: number;
	lastSeen: number;
}
