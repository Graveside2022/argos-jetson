<!-- Terminal connection error overlay shown when WebSocket retries are exhausted -->
<script lang="ts">
	import Terminal from 'carbon-icons-svelte/lib/Terminal.svelte';

	interface Props {
		maxRetries: number;
	}

	let { maxRetries }: Props = $props();
</script>

<div class="error-overlay">
	<div class="error-content">
		<Terminal size={32} />
		<span class="error-title">Terminal Unavailable</span>
		<span class="error-detail"
			>Could not connect to terminal server after {maxRetries} attempts.</span
		>
		<code class="error-cmd">Check that the dev server is running (npm run dev)</code>
	</div>
</div>

<style>
	.error-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--cds-overlay);
		z-index: 10;
	}
	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 32px;
		color: var(--cds-text-helper);
		text-align: center;
	}
	.error-content svg {
		color: var(--cds-text-helper);
	}
	.error-title {
		font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
		font-size: 16px;
		font-weight: 600;
		color: var(--cds-text-primary);
	}
	.error-detail {
		font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
		font-size: 14px;
		color: var(--cds-text-helper);
	}
	.error-cmd {
		font-family: var(--cds-code-01-font-family);
		font-size: 14px;
		background: var(--cds-layer);
		padding: 8px 16px;
		border-radius: 4px;
		color: var(--cds-link-primary);
		border: 1px solid var(--cds-border-subtle);
	}
</style>
