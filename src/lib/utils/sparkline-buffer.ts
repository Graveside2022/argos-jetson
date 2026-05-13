// Pure helpers for rolling-buffer sparklines (host metrics tile + overview
// sensor tiles). pushSample returns a new array so Svelte 5 reactivity
// catches the change. bytesPerSecond returns 0 for first-sample / negative-dt
// / negative-byte-delta (counter wrap).
//
// Lives in utils/ (not components/) so consumers in different component
// families can share without an upward dep into screens/systems/.

export const METRIC_WINDOW = 40;

export interface ByteSample {
	bytes: number;
	t: number;
}

export function pushSample(
	buffer: readonly number[],
	next: number,
	max: number = METRIC_WINDOW
): number[] {
	if (max <= 0) return [];
	if (buffer.length < max) return [...buffer, next];
	return [...buffer.slice(buffer.length - max + 1), next];
}

export function bytesPerSecond(prev: ByteSample | null, curr: ByteSample): number {
	if (prev === null) return 0;
	const dt = curr.t - prev.t;
	if (dt <= 0) return 0;
	const db = curr.bytes - prev.bytes;
	if (db < 0) return 0;
	return db / (dt / 1000) / (1024 * 1024);
}
