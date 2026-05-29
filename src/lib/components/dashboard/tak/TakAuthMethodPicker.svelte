<script lang="ts">
	import RadioButton from '$lib/components/chassis/forms/RadioButton.svelte';
	import RadioButtonGroup from '$lib/components/chassis/forms/RadioButtonGroup.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	let { config = $bindable() }: { config: TakServerConfig } = $props();
</script>

<div class="auth-section">
	<span class="auth-label"> AUTHENTICATION </span>
	<RadioButtonGroup
		bind:selected={config.authMethod}
		legendText="Authentication method"
		hideLegend
		orientation="vertical"
		class="auth-method-group"
	>
		<RadioButton labelText="Import Certificate (.p12)" value="import" class="auth-chip" />
		<RadioButton labelText="Enroll for Certificate" value="enroll" class="auth-chip" />
	</RadioButtonGroup>
</div>

<style>
	.auth-section {
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 60%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--cds-layer) 40%, transparent);
	}

	.auth-label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	/* Chip-pill skin around Carbon's RadioButton wrapper.
	   Selectors are :global because Carbon ships its own DOM that Svelte's
	   scoped-CSS hashing cannot reach. */
	:global(.auth-method-group .bx--radio-button-wrapper.auth-chip) {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 40%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--cds-layer) 10%, transparent);
		color: var(--cds-text-helper);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	:global(.auth-method-group .bx--radio-button-wrapper.auth-chip:hover) {
		background: color-mix(in srgb, var(--cds-layer) 30%, transparent);
	}

	:global(
		.auth-method-group .bx--radio-button-wrapper.auth-chip:has(input[type='radio']:checked)
	) {
		border-color: color-mix(in srgb, var(--cds-link-primary) 60%, transparent);
		background: color-mix(in srgb, var(--cds-link-primary) 10%, transparent);
		color: var(--cds-text-primary);
	}

	/* Vertical stack spacing — Carbon's default vertical group spacing */
	:global(.auth-method-group.bx--radio-button-group--vertical) {
		gap: 0.5rem;
	}
</style>
