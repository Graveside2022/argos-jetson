// Cross-screen reuse shim for the rolling-buffer helper. Re-exports the
// pure functions originally extracted for the SYSTEMS host-metrics tab so
// the OVERVIEW sensor tiles can share the same window math without a
// dependency upward into screens/systems/.
export type { ByteSample } from '$lib/components/screens/systems/system-metrics-buffer';
export {
	bytesPerSecond,
	METRIC_WINDOW,
	pushSample} from '$lib/components/screens/systems/system-metrics-buffer';
