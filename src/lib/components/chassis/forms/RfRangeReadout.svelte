<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		unit?: string;
		class?: string;
	}

	const { label, value, unit, class: className = '' }: Props = $props();
</script>

<div class={`rf-range-readout ${className}`.trim()}>
	<span class="label">{label}</span>
	<span class="value">
		{value}
		{#if unit}<span class="unit">{unit}</span>{/if}
	</span>
</div>

<style>
	.rf-range-readout {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.label {
		font-family: var(--mk2-f-mono);
		font-size: var(--mk2-fs-1);
		color: var(--mk2-ink-3);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.value {
		font-family: var(--mk2-f-mono);
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink);
		letter-spacing: 0.02em;
	}

	.unit {
		font-size: var(--mk2-fs-1);
		color: var(--mk2-ink-4);
		margin-left: 5px;
	}
</style>
