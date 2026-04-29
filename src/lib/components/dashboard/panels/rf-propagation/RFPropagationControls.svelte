<!-- RF Propagation parameter controls — compact form for CloudRF computation settings -->
<script lang="ts">
	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import { rfParams, updateRFParam } from '$lib/stores/dashboard/rf-propagation-store';

	function setRfNumber(
		key: 'frequency' | 'txHeight' | 'rxHeight' | 'radius' | 'resolution',
		v: number | null
	): void {
		if (v != null) updateRFParam(key, v);
	}

	function handlePolarization(e: Event) {
		updateRFParam('polarization', parseInt((e.target as HTMLSelectElement).value, 10));
	}
</script>

<section class="rf-controls">
	<h3 class="section-label">RF PARAMETERS</h3>

	<div class="field-grid">
		<NumberInput
			labelText="FREQUENCY (MHz)"
			value={$rfParams.frequency}
			min={1}
			max={100000}
			step={1}
			size="sm"
			hideSteppers
			disableWheel
			onChange={(v) => setRfNumber('frequency', v)}
		/>

		<label class="field">
			<span class="field-label">POLARIZATION</span>
			<select
				class="field-input field-select"
				value={$rfParams.polarization}
				onchange={handlePolarization}
			>
				<option value={0}>Horizontal</option>
				<option value={1}>Vertical</option>
			</select>
		</label>
	</div>

	<div class="field-grid">
		<NumberInput
			labelText="TX HEIGHT (m)"
			value={$rfParams.txHeight}
			min={0.5}
			max={500}
			step={0.5}
			size="sm"
			hideSteppers
			disableWheel
			onChange={(v) => setRfNumber('txHeight', v)}
		/>

		<NumberInput
			labelText="RX HEIGHT (m)"
			value={$rfParams.rxHeight}
			min={0.5}
			max={500}
			step={0.5}
			size="sm"
			hideSteppers
			disableWheel
			onChange={(v) => setRfNumber('rxHeight', v)}
		/>
	</div>

	<div class="field-grid">
		<NumberInput
			labelText="RADIUS (km)"
			value={$rfParams.radius}
			min={0.1}
			max={100}
			step={0.5}
			size="sm"
			hideSteppers
			disableWheel
			onChange={(v) => setRfNumber('radius', v)}
		/>

		<NumberInput
			labelText="RESOLUTION (m/px)"
			value={$rfParams.resolution}
			min={5}
			max={300}
			step={5}
			size="sm"
			hideSteppers
			disableWheel
			onChange={(v) => setRfNumber('resolution', v)}
		/>
	</div>
</section>

<style>
	.rf-controls {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
		margin: 0;
	}

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
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
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 6px center;
	}

	.field-select option {
		background: var(--card, #1a1a1a);
		color: var(--foreground);
	}

</style>
