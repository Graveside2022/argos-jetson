<!--
	PR-6 TimeScrubber — slider bound to the active session's start..end range.
	Drag fires a debounced aggregate fetch so dragging doesn't hammer the
	server. Two thumbs (start + end) implemented as two range inputs.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';

	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';

	interface ActiveSessionRange {
		min: number;
		max: number;
	}

	function sessionRange(s: {
		startedAt: number;
		endedAt: number | null;
	}): ActiveSessionRange | null {
		const min = s.startedAt > 0 ? s.startedAt : 0;
		const max = s.endedAt ?? Date.now();
		return max > min ? { min, max } : null;
	}

	function activeRange(): ActiveSessionRange | null {
		const id = rfVisualization.activeSessionId;
		if (!id) return null;
		const s = rfVisualization.sessionsList.find((x) => x.id === id);
		return s ? sessionRange(s) : null;
	}

	const range = $derived(activeRange());

	let startTs = $state<number | null>(null);
	let endTs = $state<number | null>(null);

	$effect(() => {
		if (!range) return;
		if (startTs === null) startTs = range.min;
		if (endTs === null) endTs = range.max;
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleApply(): void {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			rfVisualization.setFilters({
				startTs: startTs ?? undefined,
				endTs: endTs ?? undefined
			});
			void rfVisualization.load();
		}, 250);
	}

	// Cancel any pending debounced apply on unmount so a stale timer can't
	// call rfVisualization.setFilters/load against a destroyed component.
	onDestroy(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	});

	/**
	 * Clamp a slider value into [min,max] and ensure start ≤ end. Called from
	 * each range input's `oninput` so the server never receives an inverted
	 * window if the operator drags one thumb past the other.
	 */
	function onStartInput(event: Event): void {
		if (!range) return;
		const raw = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(raw)) return;
		const clamped = Math.min(Math.max(raw, range.min), endTs ?? range.max);
		startTs = clamped;
		// Reflect clamping in the input itself so the thumb snaps visually.
		(event.currentTarget as HTMLInputElement).value = String(clamped);
		scheduleApply();
	}

	function onEndInput(event: Event): void {
		if (!range) return;
		const raw = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(raw)) return;
		const clamped = Math.max(Math.min(raw, range.max), startTs ?? range.min);
		endTs = clamped;
		(event.currentTarget as HTMLInputElement).value = String(clamped);
		scheduleApply();
	}

	function reset(): void {
		if (!range) return;
		startTs = range.min;
		endTs = range.max;
		rfVisualization.setFilters({ startTs: undefined, endTs: undefined });
		void rfVisualization.load();
	}

	function fmtTs(ts: number | null): string {
		if (ts === null || !Number.isFinite(ts) || ts === 0) return '—';
		return new Date(ts).toISOString().replace('T', ' ').slice(5, 16);
	}
</script>

{#if range}
	<div class="scrubber">
		<div class="scrub-head">
			<span class="sc-label">TIME WINDOW</span>
			<button type="button" class="sc-reset" onclick={reset}>reset</button>
		</div>

		<div class="sc-track">
			<label class="sc-field">
				<span class="sc-key">start</span>
				<input
					type="range"
					min={range.min}
					max={range.max}
					step="1000"
					bind:value={startTs}
					oninput={onStartInput}
				/>
				<span class="sc-val">{fmtTs(startTs)}</span>
			</label>

			<label class="sc-field">
				<span class="sc-key">end</span>
				<input
					type="range"
					min={range.min}
					max={range.max}
					step="1000"
					bind:value={endTs}
					oninput={onEndInput}
				/>
				<span class="sc-val">{fmtTs(endTs)}</span>
			</label>
		</div>
	</div>
{/if}

<style>
	.scrubber {
		display: flex;
		flex-direction: column;
		gap: 0.4em;
		padding: 0.55em 0.75em;
		font-family: 'Fira Code', ui-monospace, monospace;
	}
	.scrub-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.sc-label {
		font-size: 0.68em;
		letter-spacing: 0.1em;
		color: var(--muted-foreground);
	}
	.sc-reset {
		background: transparent;
		color: var(--muted-foreground);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0.1em 0.5em;
		font-family: inherit;
		font-size: 0.68em;
		cursor: pointer;
	}
	.sc-reset:hover {
		color: var(--foreground);
	}
	.sc-track {
		display: flex;
		flex-direction: column;
		gap: 0.35em;
	}
	.sc-field {
		display: grid;
		grid-template-columns: 3em 1fr 8em;
		align-items: center;
		gap: 0.5em;
	}
	.sc-key {
		font-size: 0.62em;
		letter-spacing: 0.08em;
		color: var(--muted-foreground);
	}
	.sc-val {
		font-size: 0.72em;
		color: var(--foreground);
		text-align: right;
	}
	input[type='range'] {
		accent-color: var(--primary);
		width: 100%;
	}
</style>
