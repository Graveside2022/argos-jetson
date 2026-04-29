<!-- RF Advanced parameter controls — collapsible section for CloudRF power/model/environment -->
<script lang="ts">
	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import { rfParams, updateRFParam } from '$lib/stores/dashboard/rf-propagation-store';
	import type {
		ClutterProfile,
		PropagationModelId,
		ReliabilityPercent
	} from '$lib/types/rf-propagation';
	import {
		autoSelectPropModel,
		CLUTTER_PROFILES,
		PROPAGATION_MODELS,
		RELIABILITY_OPTIONS
	} from '$lib/types/rf-propagation';

	let expanded = $state(false);

	/** Label for the auto-selected propagation model based on current frequency */
	const autoModelLabel = $derived.by(() => {
		const autoId = autoSelectPropModel($rfParams.frequency);
		const model = PROPAGATION_MODELS.find((m) => m.id === autoId);
		return model ? model.label : 'Auto';
	});

	function setRfNumber(key: 'txPower' | 'rxSensitivity', v: number | null): void {
		if (v != null) updateRFParam(key, v);
	}

	function handleClutter(e: Event) {
		updateRFParam('clutterProfile', (e.target as HTMLSelectElement).value as ClutterProfile);
	}

	function handlePropModel(e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		updateRFParam(
			'propagationModel',
			val === 'auto' ? null : (Number(val) as PropagationModelId)
		);
	}

	function handleReliability(e: Event) {
		updateRFParam(
			'reliability',
			Number((e.target as HTMLSelectElement).value) as ReliabilityPercent
		);
	}
</script>

<section class="rf-advanced">
	<button class="section-toggle" onclick={() => (expanded = !expanded)}>
		<span class="section-label">ADVANCED</span>
		<span class="chevron" class:expanded>&#9662;</span>
	</button>

	{#if expanded}
		<div class="advanced-body">
			<div class="field-grid">
				<NumberInput
					labelText="TX POWER (W)"
					value={$rfParams.txPower}
					min={0.001}
					max={100}
					step={0.5}
					size="sm"
					hideSteppers
					disableWheel
					onChange={(v) => setRfNumber('txPower', v)}
				/>

				<NumberInput
					labelText="RX SENSITIVITY (dBm)"
					value={$rfParams.rxSensitivity}
					min={-150}
					max={0}
					step={1}
					size="sm"
					hideSteppers
					disableWheel
					onChange={(v) => setRfNumber('rxSensitivity', v)}
				/>
			</div>

			<div class="field-grid">
				<label class="field">
					<span class="field-label">ENVIRONMENT</span>
					<select
						class="field-input field-select"
						value={$rfParams.clutterProfile}
						onchange={handleClutter}
					>
						{#each CLUTTER_PROFILES as profile (profile.id)}
							<option value={profile.id}>{profile.label}</option>
						{/each}
					</select>
				</label>

				<label class="field">
					<span class="field-label">RELIABILITY</span>
					<select
						class="field-input field-select"
						value={$rfParams.reliability}
						onchange={handleReliability}
					>
						{#each RELIABILITY_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="field-grid field-grid--full">
				<label class="field">
					<span class="field-label">PROP MODEL</span>
					<select
						class="field-input field-select"
						value={$rfParams.propagationModel === null
							? 'auto'
							: String($rfParams.propagationModel)}
						onchange={handlePropModel}
					>
						<option value="auto">Auto ({autoModelLabel})</option>
						{#each PROPAGATION_MODELS as model (model.id)}
							<option value={String(model.id)}>{model.label} ({model.band})</option>
						{/each}
					</select>
				</label>
			</div>
		</div>
	{/if}
</section>

<style>
	.rf-advanced {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
	}

	.section-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.section-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
	}

	.chevron {
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
		transition: transform 0.15s;
		transform: rotate(-90deg);
	}

	.chevron.expanded {
		transform: rotate(0deg);
	}

	.advanced-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 8px;
	}

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.field-grid--full {
		grid-template-columns: 1fr;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.field-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
	}

	.field-input {
		flex: 1;
		background: var(--surface-elevated, #151515);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 4px 8px;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		color: var(--foreground);
		min-width: 0;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.field-select {
		appearance: none;
		cursor: pointer;
		padding-right: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 6px center;
	}

	.field-select option {
		background: var(--card, #1a1a1a);
		color: var(--foreground);
	}

</style>
