// spec-024 PR4 T024 — pure helpers for the SYSTEMS host-metrics tab.
//
// Two tiny operations the gauge tiles need on every poll:
//
//   pushSample()  — append a value to a rolling-window buffer, dropping the
//                   oldest entry once the cap is reached. Returns a NEW array
//                   so Svelte 5 reactivity catches the change without us
//                   having to mutate-and-reassign on the caller side.
//
//   bytesPerSecond() — derive instantaneous throughput in MB/s from two
//                   cumulative byte counters (/proc/net/dev style, exposed by
//                   /api/system/metrics → network.{rx,tx}). The first sample
//                   has no previous reference, so it returns 0 instead of
//                   guessing.

export const METRIC_WINDOW = 40;

/** Bytes counter sample taken at a wall-clock instant. */
export interface ByteSample {
	bytes: number;
	t: number;
}

/**
 * Append `next` to `buffer`, evicting from the front so length never exceeds
 * `max`. Pure — `buffer` is not mutated.
 */
export function pushSample(
	buffer: readonly number[],
	next: number,
	max: number = METRIC_WINDOW
): number[] {
	if (max <= 0) return [];
	if (buffer.length < max) return [...buffer, next];
	return [...buffer.slice(buffer.length - max + 1), next];
}

/**
 * Derive throughput in MB/s from two cumulative byte samples.
 *   - First sample (`prev === null`) → 0 (no baseline to diff against).
 *   - Negative diff (counter wraparound, iface restart) → 0.
 *   - Identical timestamps → 0 (avoids division by zero).
 */
export function bytesPerSecond(prev: ByteSample | null, curr: ByteSample): number {
	if (prev === null) return 0;
	const dt = curr.t - prev.t;
	if (dt <= 0) return 0;
	const db = curr.bytes - prev.bytes;
	if (db < 0) return 0;
	const bytesPerSec = db / (dt / 1000);
	return bytesPerSec / (1024 * 1024);
}
