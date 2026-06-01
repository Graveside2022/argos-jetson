<script lang="ts">
	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import TextInput from '$lib/components/chassis/forms/TextInput.svelte';
	import Toggle from '$lib/components/chassis/forms/Toggle.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	let { config = $bindable() }: { config: TakServerConfig } = $props();
</script>

<div class="tak-section">
	<span class="tak-label">SERVER</span>
	<div class="tak-fields">
		<TextInput
			labelText="Description"
			placeholder="Unit TAK Server"
			bind:value={config.name}
			size="sm"
		/>
		<div class="field-row">
			<div class="field-grow">
				<TextInput
					labelText="Hostname / IP"
					placeholder="192.168.1.100"
					bind:value={config.hostname}
					size="sm"
				/>
			</div>
			<div class="field-port">
				<NumberInput
					labelText="Port"
					bind:value={config.port}
					placeholder="8089"
					min={1}
					max={65535}
					step={1}
					size="sm"
					hideSteppers
					disableWheel
				/>
			</div>
		</div>
		<div class="startup-row">
			<Toggle
				bind:toggled={config.shouldConnectOnStartup}
				labelText="Connect on startup"
				size="sm"
			/>
		</div>
	</div>
</div>

<style>
	.tak-section {
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 60%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--cds-layer) 40%, transparent);
	}

	.tak-label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	.tak-fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.field-row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.field-grow {
		flex: 2;
	}

	.field-port {
		flex: 1;
	}

	.startup-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 40%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--cds-layer) 20%, transparent);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--cds-text-primary);
		transition: background-color 0.15s ease;
	}

	.startup-row:hover {
		background: color-mix(in srgb, var(--cds-layer) 40%, transparent);
	}
</style>
