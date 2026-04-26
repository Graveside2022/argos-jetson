/**
 * Composite signal designator for SIGINT operator triage.
 *
 * Format: `{SOURCE3}·{FREQ_MHZ}·{ID_TAIL4}` — every glyph projects from a real
 * column on `rf_signals.signals` (source / frequency / signal_id). No invented
 * fields. If any input is missing, returns null so the caller renders the
 * empty-state token (`—`) instead of fabricating a placeholder.
 */
export function signalDesignator(
	source: string | null | undefined,
	frequencyMHz: number | null | undefined,
	signalId: string | null | undefined
): string | null {
	const src = formatSource(source);
	const freq = formatFrequency(frequencyMHz);
	const tail = formatIdTail(signalId);
	if (src === null || freq === null || tail === null) return null;
	return `${src}·${freq}·${tail}`;
}

function formatSource(source: string | null | undefined): string | null {
	if (typeof source !== 'string' || source.length === 0) return null;
	return source.slice(0, 3).toUpperCase();
}

function formatFrequency(frequencyMHz: number | null | undefined): string | null {
	if (typeof frequencyMHz !== 'number' || !Number.isFinite(frequencyMHz)) return null;
	if (frequencyMHz <= 0) return null;
	return Math.round(frequencyMHz).toString();
}

function formatIdTail(signalId: string | null | undefined): string | null {
	if (typeof signalId !== 'string' || signalId.length === 0) return null;
	return signalId.slice(-4).toLowerCase();
}
