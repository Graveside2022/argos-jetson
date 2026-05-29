<script lang="ts">
	import { gpOutput } from '$lib/stores/globalprotect-store.svelte';

	let consoleEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (gpOutput.current.length && consoleEl) {
			consoleEl.scrollTop = consoleEl.scrollHeight;
		}
	});
</script>

<div class="gp-console-card">
	<span class="gp-label">CONSOLE</span>
	<div bind:this={consoleEl} class="gp-console">
		{#if gpOutput.current.length === 0}
			<span class="gp-empty">No output — connect to see openconnect logs</span>
		{:else}
			{#each gpOutput.current as line, i (i)}
				<div
					class:line-ok={line.toLowerCase().includes('connected')}
					class:line-error={line.toLowerCase().includes('error') ||
						line.toLowerCase().includes('failed')}
					class:line-warn={line.toLowerCase().includes('warning') ||
						line.toLowerCase().includes('dtls')}
				>
					{line}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.gp-console-card {
		display: flex;
		height: 100%;
		flex-direction: column;
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 60%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--cds-layer) 40%, transparent);
	}

	.gp-label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	.gp-console {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 30%, transparent);
		border-radius: 0.375rem;
		background: var(--cds-background);
		font-family: var(--cds-code-01-font-family);
		font-size: 0.875rem;
		line-height: 1.625;
		color: var(--cds-text-helper);
	}

	.gp-empty {
		font-style: italic;
		color: color-mix(in srgb, var(--cds-text-helper) 50%, transparent);
	}

	.line-ok {
		color: var(--cds-support-success);
	}

	.line-error {
		color: var(--cds-support-error);
	}

	.line-warn {
		color: var(--cds-support-warning);
	}
</style>
