<script lang="ts">
	// spec-024 PR10b T052 — Mk II GSM frequency tuner.
	//
	// User enters MHz directly (e.g. "947.2") + START/STOP. The
	// /api/gsm-evil/control endpoint accepts MHz strings, not ARFCN
	// integers — there's no set-arfcn action in the API surface today.
	// ARFCN-to-MHz conversion (3GPP TS 45.005) is a future polish; this
	// initial tuner ships with the actual API contract. Status badge
	// shows running/stopped from /api/gsm-evil/status.

	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import { gsmStore } from '$lib/state/gsm.svelte';

	let entered = $state<number | null>(947.2);

	// Some /api/gsm-evil/status responses include the unit suffix in
	// the frequency field (e.g. "948.6 MHz"); some don't. Strip it once
	// here so the tuner badge renders "948.6 MHz" cleanly without
	// double-printing the unit.
	function stripUnit(f: string | null): string | null {
		if (f === null) return null;
		return f.replace(/\s*MHz\s*$/i, '').trim();
	}

	function onStart(): void {
		if (entered != null) void gsmStore.startScanner(entered.toString());
	}

	function onStop(): void {
		void gsmStore.stopScanner();
	}
</script>

<div class="tuner" role="group" aria-label="GSM frequency tuner">
	<NumberInput
		labelText="FREQ (MHz)"
		bind:value={entered}
		min={0}
		max={6000}
		step={0.1}
		allowDecimal
		placeholder="947.2"
		size="sm"
		hideSteppers
		disableWheel
	/>
	<button type="button" class="ctl-btn" disabled={entered == null} onclick={onStart}>
		START
	</button>
	<button type="button" class="ctl-btn" onclick={onStop}>STOP</button>
	<span class="status" data-running={gsmStore.running}>
		{gsmStore.running ? 'RUNNING' : 'STOPPED'}
		{#if gsmStore.frequencyMHz}· {stripUnit(gsmStore.frequencyMHz)} MHz{/if}
	</span>
	{#if gsmStore.lastError}<span class="err" role="alert">{gsmStore.lastError}</span>{/if}
</div>

<style>
	.tuner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		font-family: 'Fira Code', monospace;
		font-size: 11px;
	}
	.ctl-btn {
		padding: 4px 10px;
		background: transparent;
		border: 1px solid var(--mk2-line, var(--border));
		color: var(--mk2-ink, var(--foreground));
		font: 500 10px / 1 inherit;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.ctl-btn:hover:not(:disabled) {
		color: var(--mk2-accent, var(--primary));
		border-color: var(--mk2-accent, var(--primary));
	}
	.ctl-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.status {
		font-size: 10px;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-left: auto;
	}
	.status[data-running='true'] {
		color: var(--mk2-accent, var(--primary));
	}
	.err {
		color: var(--mk2-err, #ff5c33);
		font-size: 10px;
	}
</style>
