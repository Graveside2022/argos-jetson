<script lang="ts">
	import { Tag } from 'carbon-components-svelte';

	let { scanProgress = [], isScanning = false }: { scanProgress: string[]; isScanning: boolean } =
		$props();
</script>

<div class="scan-console-card">
	<div class="console-header">
		<span class="console-label">CONSOLE</span>
		{#if isScanning}
			<Tag type="outline" size="sm" class="scan-tag-active">SCANNING...</Tag>
		{:else if scanProgress.length > 0}
			<Tag type="gray" size="sm">COMPLETE</Tag>
		{/if}
	</div>
	<div class="console-body scan-progress-body">
		{#if scanProgress.length > 0}
			{#each scanProgress as line, i (i)}
				<div
					class="console-line {line.startsWith('[ERROR]')
						? 'error'
						: line.startsWith('[CMD]')
							? 'command'
							: line.startsWith('[TEST')
								? 'test'
								: line.includes('=====')
									? 'header'
									: ''}"
				>
					{line}
				</div>
			{/each}
			{#if isScanning}
				<div class="console-cursor">█</div>
			{/if}
		{:else}
			<div class="console-line empty">Click 'Start Scan' to begin</div>
		{/if}
	</div>
</div>

<style>
	.scan-console-card {
		margin: 1rem 0;
		border: 2px solid var(--cds-border-subtle);
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.console-header {
		background: linear-gradient(
			to right,
			var(--cds-layer),
			color-mix(in srgb, var(--cds-layer) 80%, transparent)
		);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--cds-border-subtle);
	}

	.console-label {
		font-size: 1rem;
		font-weight: 600;
		color: var(--cds-text-primary);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.scan-tag-active :global(.bx--tag),
	.console-header :global(.scan-tag-active) {
		color: var(--cds-support-warning);
		animation: scan-pulse 1.5s ease-in-out infinite;
	}

	.console-body {
		padding: 1rem;
		height: 400px;
		overflow-y: auto;
		font-family: var(--cds-code-01-font-family);
		font-size: 0.875rem;
		line-height: 1.6;
		background: color-mix(in srgb, var(--cds-background) 80%, black);
	}

	.console-line {
		color: var(--cds-text-helper);
		white-space: pre-wrap;
		word-break: break-all;
		margin-bottom: 0.25rem;
	}

	.console-line.empty {
		color: var(--cds-text-helper);
	}

	.console-line.error {
		color: var(--cds-support-error);
		font-weight: bold;
	}

	/* Console syntax colors keep the data-viz chart palette (charts phase) */
	.console-line.command {
		color: var(--color-chart-2);
	}

	.console-line.test {
		color: var(--color-chart-1);
	}

	.console-line.header {
		color: var(--color-chart-4);
		font-weight: bold;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.console-cursor {
		display: inline-block;
		animation: blink 1s infinite;
		color: var(--color-chart-2);
		font-weight: bold;
	}

	.console-body::-webkit-scrollbar {
		width: 10px;
	}

	.console-body::-webkit-scrollbar-track {
		background: var(--cds-layer);
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb {
		background: var(--cds-border-subtle);
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb:hover {
		background: color-mix(in srgb, var(--cds-text-helper) 30%, transparent);
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}

	@keyframes scan-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
