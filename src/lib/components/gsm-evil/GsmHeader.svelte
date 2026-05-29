<script lang="ts">
	import { Button } from 'carbon-components-svelte';

	let {
		isActive = false,
		buttonText = 'Start Scan',
		onscanbutton
	}: {
		isActive: boolean;
		buttonText: string;
		onscanbutton: () => void;
	} = $props();
</script>

<div class="gsm-header">
	<div class="gsm-header-actions">
		<Button kind={isActive ? 'danger' : 'secondary'} size="small" on:click={onscanbutton}>
			{buttonText}
		</Button>
	</div>
</div>

<style>
	.gsm-header {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		height: 2.5rem;
		padding: 0 2rem;
		background: color-mix(in srgb, var(--cds-layer) 20%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--cds-border-subtle) 40%, transparent);
	}

	.gsm-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
