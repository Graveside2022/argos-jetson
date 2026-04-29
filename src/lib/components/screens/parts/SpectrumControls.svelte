<!--
  Spec-024 PR9a-2 — HackRF spectrum control surface.

  Form for editing the persisted SpectrumConfig and starting/stopping
  the active source via /api/spectrum/{start,stop}. Device is hardcoded
  to 'hackrf' in PR9a-2; PR9b will add a SpectrumControlsB205 sibling
  + SpectrumDevicePicker that swaps between them.

  HackRF gain ranges per `hackrf_sweep -h`:
    - amp: 0 or 1 (RX RF amplifier on/off)
    - lna: 0–40 dB, step 8 (IF gain)
    - vga: 0–62 dB, step 2 (baseband gain)
  Bin-width range per `hackrf_sweep -w`: 2445 – 5_000_000 Hz.

  POST shape matches StartSpectrumRequestSchema in src/lib/schemas/spectrum.ts.
-->
<script lang="ts">
	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import { spectrumConfigStore, spectrumRuntime } from '$lib/state/spectrum.svelte';
	import type { GainConfig, SpectrumConfig } from '$lib/types/spectrum';

	const LNA_STEPS = [0, 8, 16, 24, 32, 40];
	// 0-62 dB step 2 per `hackrf_sweep -h` — full range, 32 values.
	const VGA_STEPS = Array.from({ length: 32 }, (_, i) => i * 2);
	const BIN_PRESETS = [
		{ label: '20 kHz', hz: 20_000 },
		{ label: '50 kHz', hz: 50_000 },
		{ label: '100 kHz', hz: 100_000 },
		{ label: '500 kHz', hz: 500_000 },
		{ label: '1 MHz', hz: 1_000_000 }
	];

	let busy = $state(false);
	let postError = $state<string | null>(null);

	const gain = $derived(coerceHackrfGain(spectrumConfigStore.value.gain));

	function coerceHackrfGain(g: GainConfig): { amp: 0 | 1; lna: number; vga: number } {
		if (g.kind === 'hackrf') return { amp: g.amp, lna: g.lna, vga: g.vga };
		return { amp: 0, lna: 32, vga: 20 };
	}

	function patchConfig(patch: Partial<SpectrumConfig>): void {
		spectrumConfigStore.value = { ...spectrumConfigStore.value, ...patch };
	}

	function patchHackrfGain(patch: Partial<{ amp: 0 | 1; lna: number; vga: number }>): void {
		const next: GainConfig = {
			kind: 'hackrf',
			amp: patch.amp ?? gain.amp,
			lna: patch.lna ?? gain.lna,
			vga: patch.vga ?? gain.vga
		};
		patchConfig({ gain: next });
	}

	async function startStream(): Promise<void> {
		busy = true;
		postError = null;
		try {
			const res = await fetch('/api/spectrum/start', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					device: 'hackrf',
					config: spectrumConfigStore.value
				})
			});
			if (!res.ok) {
				postError = `start failed: ${res.status} ${res.statusText}`;
				spectrumRuntime.setError(postError);
			}
		} catch (err) {
			postError = err instanceof Error ? err.message : String(err);
			spectrumRuntime.setError(postError);
		} finally {
			busy = false;
		}
	}

	async function stopStream(): Promise<void> {
		busy = true;
		postError = null;
		try {
			const res = await fetch('/api/spectrum/stop', { method: 'POST' });
			if (!res.ok) {
				postError = `stop failed: ${res.status} ${res.statusText}`;
				spectrumRuntime.setError(postError);
			}
			spectrumRuntime.resetPeakHold();
		} catch (err) {
			postError = err instanceof Error ? err.message : String(err);
			spectrumRuntime.setError(postError);
		} finally {
			busy = false;
		}
	}

	const isStreaming = $derived(spectrumRuntime.sourceState === 'streaming');
</script>

<form
	class="controls"
	onsubmit={(e) => {
		e.preventDefault();
		if (isStreaming) stopStream();
		else startStream();
	}}
>
	<header>
		<span class="brand">SPECTRUM · HACKRF</span>
		<span class="state" data-state={spectrumRuntime.sourceState ?? 'idle'}
			>{spectrumRuntime.sourceState ?? 'idle'}</span
		>
	</header>

	<fieldset disabled={busy}>
		<NumberInput
			labelText="start (MHz)"
			value={spectrumConfigStore.value.startFreq / 1e6}
			min={1}
			max={6000}
			step={1}
			size="sm"
			hideSteppers
			disableWheel
			onChange={(v) => v != null && patchConfig({ startFreq: v * 1e6 })}
		/>

		<NumberInput
			labelText="stop (MHz)"
			value={spectrumConfigStore.value.endFreq / 1e6}
			min={1}
			max={6000}
			step={1}
			size="sm"
			hideSteppers
			disableWheel
			onChange={(v) => v != null && patchConfig({ endFreq: v * 1e6 })}
		/>

		<label>
			<span>bin width</span>
			<select
				value={spectrumConfigStore.value.binWidth}
				onchange={(e) => patchConfig({ binWidth: Number(e.currentTarget.value) })}
			>
				{#each BIN_PRESETS as p (p.hz)}
					<option value={p.hz}>{p.label}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>amp</span>
			<select
				value={gain.amp}
				onchange={(e) => patchHackrfGain({ amp: Number(e.currentTarget.value) as 0 | 1 })}
			>
				<option value={0}>off</option>
				<option value={1}>on (+14 dB)</option>
			</select>
		</label>

		<label>
			<span>LNA (dB)</span>
			<select
				value={gain.lna}
				onchange={(e) => patchHackrfGain({ lna: Number(e.currentTarget.value) })}
			>
				{#each LNA_STEPS as v (v)}<option value={v}>{v}</option>{/each}
			</select>
		</label>

		<label>
			<span>VGA (dB)</span>
			<select
				value={gain.vga}
				onchange={(e) => patchHackrfGain({ vga: Number(e.currentTarget.value) })}
			>
				{#each VGA_STEPS as v (v)}<option value={v}>{v}</option>{/each}
			</select>
		</label>
	</fieldset>

	<div class="actions">
		<button type="submit" disabled={busy} class="primary">
			{#if busy}…{:else if isStreaming}STOP{:else}START{/if}
		</button>
		{#if postError}
			<span class="err" role="alert">{postError}</span>
		{/if}
	</div>
</form>

<style>
	.controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 12px;
		font-family: var(--mk2-f-mono);
		color: var(--mk2-ink);
		background: var(--mk2-bg-2);
		border: 1px solid var(--mk2-line);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.brand {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
		color: var(--mk2-accent);
	}
	.state {
		font-size: var(--mk2-fs-1);
		letter-spacing: 0.1em;
		color: var(--mk2-ink-3);
		text-transform: uppercase;
	}
	.state[data-state='streaming'] {
		color: var(--mk2-green);
	}
	.state[data-state='error'] {
		color: var(--mk2-amber);
	}
	fieldset {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px 12px;
		border: 0;
		padding: 0;
		margin: 0;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	label span {
		font-size: var(--mk2-fs-1);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--mk2-ink-3);
	}
	select {
		font-family: var(--mk2-f-mono);
		font-size: var(--mk2-fs-3);
		background: var(--mk2-bg);
		color: var(--mk2-ink);
		border: 1px solid var(--mk2-line);
		padding: 3px 6px;
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	button.primary {
		font-family: var(--mk2-f-mono);
		font-size: var(--mk2-fs-3);
		letter-spacing: 0.1em;
		padding: 6px 14px;
		background: var(--mk2-accent);
		color: var(--mk2-bg);
		border: 0;
		cursor: pointer;
	}
	button.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.err {
		color: var(--mk2-amber);
		font-size: var(--mk2-fs-2);
	}
</style>
