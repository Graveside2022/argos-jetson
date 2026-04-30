<script lang="ts">
	import InlineNotification from '$lib/components/chassis/forms/InlineNotification.svelte';
	import { SelectItem } from 'carbon-components-svelte';
	import { untrack } from 'svelte';

	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import Select from '$lib/components/chassis/forms/Select.svelte';
	import type {
		Preset,
		PresetInput,
		SystemType
	} from '$lib/server/services/trunk-recorder/types';

	interface Props {
		preset?: Preset | null;
		onSave: (input: PresetInput) => Promise<void>;
		onCancel: () => void;
	}

	let { preset, onSave, onCancel }: Props = $props();

	// Convert existing preset to form state. Control channels come in Hz and
	// display as MHz for operator ergonomics. We keep MHz in state, convert to
	// Hz only at submit — avoids floating-point drift on round-trips.
	// Capture preset once at component init; form state must NOT re-initialize
	// when preset prop mutates mid-edit (would clobber operator input).
	const initial = untrack(() => preset);
	let name = $state(initial?.name ?? '');
	let systemType = $state<SystemType>(initial?.systemType ?? 'p25');
	let systemLabel = $state(initial?.systemLabel ?? '');
	let controlChannelsMhz = $state<(number | null)[]>(
		initial?.controlChannels.map((hz) => hz / 1e6) ?? [null]
	);
	let talkgroupsCsv = $state(initial?.talkgroupsCsv ?? '');
	let centerMhz = $state<number | null>(initial ? initial.sourceConfig.center / 1e6 : 856);
	let rateHz = $state<number | null>(initial?.sourceConfig.rate ?? 8_000_000);
	let gain = $state<number | null>(initial?.sourceConfig.gain ?? 40);
	let ifGain = $state<number | null>(initial?.sourceConfig.ifGain ?? 32);
	let bbGain = $state<number | null>(initial?.sourceConfig.bbGain ?? 16);

	let advancedOpen = $state(false);
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	function addControlChannel(): void {
		controlChannelsMhz = [...controlChannelsMhz, null];
	}

	function removeControlChannel(index: number): void {
		controlChannelsMhz = controlChannelsMhz.filter((_, i) => i !== index);
		if (controlChannelsMhz.length === 0) controlChannelsMhz = [null];
	}

	function updateControlChannel(index: number, value: number | null): void {
		controlChannelsMhz = controlChannelsMhz.map((v, i) => (i === index ? value : v));
	}

	function parseChannelMhz(mhz: number | null): number | { error: string } | null {
		if (mhz == null) return null;
		if (mhz <= 0) return { error: `Invalid control channel MHz: ${mhz}` };
		return Math.round(mhz * 1e6);
	}

	function pushChannel(
		channels: number[],
		r: number | { error: string } | null
	): { error: string } | null {
		if (r === null) return null;
		if (typeof r !== 'number') return r;
		channels.push(r);
		return null;
	}

	function parseControlChannels(): number[] | { error: string } {
		const channels: number[] = [];
		for (const mhz of controlChannelsMhz) {
			const err = pushChannel(channels, parseChannelMhz(mhz));
			if (err) return err;
		}
		if (channels.length === 0) return { error: 'At least one control channel required' };
		return channels;
	}

	type SourceNumbers = {
		center: number;
		rate: number;
		gain: number;
		ifGain: number;
		bbGain: number;
	};

	function requirePositive(v: number | null, label: string): number | { error: string } {
		if (v == null || v <= 0) return { error: `Invalid ${label}` };
		return v;
	}

	function requireNonNull(v: number | null, label: string): number | { error: string } {
		if (v == null) return { error: `Invalid ${label}` };
		return v;
	}

	function parseSourceConfig(): SourceNumbers | { error: string } {
		const validations = [
			requirePositive(centerMhz, 'center MHz'),
			requirePositive(rateHz, 'sample rate'),
			requireNonNull(gain, 'gain'),
			requireNonNull(ifGain, 'IF gain'),
			requireNonNull(bbGain, 'BB gain')
		];
		for (const v of validations) {
			if (typeof v !== 'number') return v;
		}
		const [center, rate, g, ig, bg] = validations as number[];
		return { center: Math.round(center * 1e6), rate, gain: g, ifGain: ig, bbGain: bg };
	}

	function buildInput(): PresetInput | { error: string } {
		if (!name.trim()) return { error: 'Name required' };
		const channels = parseControlChannels();
		if ('error' in channels) return channels;
		const src = parseSourceConfig();
		if ('error' in src) return src;
		return {
			id: preset?.id,
			name: name.trim(),
			systemType,
			systemLabel: systemLabel.trim(),
			controlChannels: channels,
			talkgroupsCsv,
			sourceConfig: { ...src, driver: 'osmosdr', device: 'hackrf=0', error: 0 }
		};
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage = null;
		const result = buildInput();
		if ('error' in result) {
			errorMessage = result.error;
			return;
		}
		submitting = true;
		try {
			await onSave(result);
		} catch (err) {
			errorMessage = `Save failed: ${String(err)}`;
		} finally {
			submitting = false;
		}
	}
</script>

<form class="preset-form" onsubmit={handleSubmit}>
	<h2>{preset ? 'Edit Preset' : 'New Preset'}</h2>

	<label>
		<span>Name</span>
		<input type="text" bind:value={name} required maxlength="80" />
	</label>

	<Select labelText="System type" bind:value={systemType} size="sm">
		<SelectItem value="p25" text="P25 (Phase 1 / Phase 2)" />
		<SelectItem value="smartnet" text="Motorola SmartNet / SmartZone" />
	</Select>

	<label>
		<span>System label (rdio-scanner display)</span>
		<input type="text" bind:value={systemLabel} maxlength="80" placeholder={name} />
	</label>

	<fieldset>
		<legend>Control channels (MHz)</legend>
		{#each controlChannelsMhz as mhz, index (index)}
			<div class="channel-row">
				<NumberInput
					labelText="Channel {index + 1}"
					hideLabel
					value={mhz}
					min={0}
					max={6000}
					step={0.0125}
					allowDecimal
					placeholder="851.0125"
					size="sm"
					hideSteppers
					disableWheel
					onChange={(v) => updateControlChannel(index, v)}
				/>
				<button
					type="button"
					class="btn-ghost"
					onclick={() => removeControlChannel(index)}
					disabled={controlChannelsMhz.length === 1}
				>
					&minus;
				</button>
			</div>
		{/each}
		<button type="button" class="btn-ghost" onclick={addControlChannel}>+ add channel</button>
	</fieldset>

	<label>
		<span>Talkgroups CSV</span>
		<textarea
			bind:value={talkgroupsCsv}
			rows="6"
			placeholder="Decimal,Mode,Description,Alpha Tag,Tag,Category,Priority"
			spellcheck="false"
		></textarea>
	</label>

	<details bind:open={advancedOpen}>
		<summary>Advanced — SDR source</summary>
		<div class="advanced-grid">
			<NumberInput
				labelText="Center (MHz)"
				bind:value={centerMhz}
				min={0}
				max={6000}
				step={0.1}
				allowDecimal
				size="sm"
				hideSteppers
				disableWheel
			/>
			<NumberInput
				labelText="Sample rate (Hz)"
				bind:value={rateHz}
				min={1}
				max={20_000_000}
				step={1}
				size="sm"
				hideSteppers
				disableWheel
			/>
			<NumberInput
				labelText="RF gain"
				bind:value={gain}
				min={0}
				max={62}
				step={1}
				size="sm"
				hideSteppers
				disableWheel
			/>
			<NumberInput
				labelText="IF gain"
				bind:value={ifGain}
				min={0}
				max={47}
				step={1}
				size="sm"
				hideSteppers
				disableWheel
			/>
			<NumberInput
				labelText="BB gain"
				bind:value={bbGain}
				min={0}
				max={62}
				step={1}
				size="sm"
				hideSteppers
				disableWheel
			/>
			<label>
				<span>SDR device</span>
				<input type="text" value="hackrf=0" readonly />
			</label>
		</div>
	</details>

	{#if errorMessage}
		<InlineNotification
			kind="error"
			title="Preset save failed"
			subtitle={errorMessage}
			hideCloseButton
			lowContrast
		/>
	{/if}

	<div class="actions">
		<button type="button" class="btn btn-cancel" onclick={onCancel} disabled={submitting}>
			Cancel
		</button>
		<button type="submit" class="btn btn-save" disabled={submitting}>
			{submitting ? 'Saving…' : 'Save'}
		</button>
	</div>
</form>

<style>
	.preset-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--card);
		color: var(--foreground);
		border: 1px solid var(--border);
		max-width: 640px;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
	}
	.preset-form h2 {
		margin: 0;
		font-size: 13px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
	}
	.preset-form label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.preset-form label > span {
		font-size: 10px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #9ca3af);
	}
	.preset-form input[type='text'],
	.preset-form textarea {
		background: var(--background);
		color: var(--foreground);
		border: 1px solid var(--border);
		padding: 0.4rem 0.5rem;
		font-family: inherit;
		font-size: 11px;
	}
	.preset-form textarea {
		resize: vertical;
	}
	.preset-form input[readonly] {
		opacity: 0.6;
	}
	fieldset {
		border: 1px solid var(--border);
		padding: 0.5rem;
	}
	fieldset legend {
		font-size: 10px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #9ca3af);
		padding: 0 0.25rem;
	}
	.channel-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
		align-items: end;
	}
	details > summary {
		cursor: pointer;
		font-size: 10px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #9ca3af);
		padding: 0.25rem 0;
	}
	.advanced-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
		padding-top: 0.5rem;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.btn {
		padding: 0.35rem 1rem;
		font-family: inherit;
		font-size: 11px;
		letter-spacing: 1px;
		text-transform: uppercase;
		border: 1px solid var(--border);
		background: var(--card);
		color: var(--foreground);
		cursor: pointer;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn-save {
		border-color: #8bbfa0;
		color: #8bbfa0;
	}
	.btn-ghost {
		background: transparent;
		border: 1px dashed var(--border);
		color: var(--muted-foreground, #9ca3af);
		padding: 0.25rem 0.75rem;
		font-family: inherit;
		font-size: 11px;
		cursor: pointer;
	}
	.btn-ghost:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
