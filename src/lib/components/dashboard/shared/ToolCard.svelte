<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Button pattern extraction deferred to component library refactor -->
<!-- @audit-svelte-no-at-html-tags 2026-05-05 — `icon` prop is a hard-coded SVG string from $lib/data/tool-icons.ts upstream; rule disabled for this file via config/eslint.config.js files-pattern override; no user input vector. -->
<script lang="ts">
	import { Button } from 'carbon-components-svelte';

	interface Props {
		name: string;
		description?: string;
		icon: string;
		status?: 'stopped' | 'starting' | 'running' | 'stopping';
		count?: number | null;
		canOpen?: boolean;
		shouldShowControls?: boolean;
		externalUrl?: string | null;
		isInstalled?: boolean;
		onStart?: () => void;
		onStop?: () => void;
		onOpen?: () => void;
	}

	let {
		name,
		description = '',
		icon,
		status = 'stopped',
		count = null,
		canOpen = true,
		shouldShowControls = true,
		externalUrl = null,
		isInstalled = true,
		onStart,
		onStop,
		onOpen
	}: Props = $props();

	let isRunning = $derived(status === 'running');
	let isTransitioning = $derived(status === 'starting' || status === 'stopping');
	let statusLabel = $derived(
		status === 'starting'
			? 'Starting...'
			: status === 'stopping'
				? 'Stopping...'
				: status === 'running'
					? 'Running'
					: 'Stopped'
	);
</script>

<div class="tool-card" class:isRunning class:not-installed={!isInstalled}>
	<div class="tool-header">
		<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
		<div class="tool-icon">
			{@html icon}
		</div>
		<div class="tool-info">
			<span class="tool-name">{name}</span>
			<div class="tool-status-row">
				{#if isInstalled}
					<span
						class="tool-status-dot"
						class:dot-active={isRunning}
						class:dot-transition={isTransitioning}
						class:dot-stopped={status === 'stopped'}
					></span>
					<span class="tool-status-label">{statusLabel}</span>
					{#if count !== null && isRunning}
						<span class="tool-count">{count}</span>
					{/if}
				{:else}
					<span class="installation-badge">Not Installed</span>
				{/if}
			</div>
		</div>
	</div>

	{#if !isRunning && description}
		<p class="tool-description">{description}</p>
	{/if}

	{#if isInstalled}
		<div class="tool-actions">
			{#if canOpen}
				{#if externalUrl}
					<Button
						kind="tertiary"
						size="small"
						href={externalUrl}
						target="_blank"
						rel="noopener noreferrer">Open</Button
					>
				{:else}
					<Button kind="tertiary" size="small" on:click={() => onOpen?.()}>Open</Button>
				{/if}
			{/if}
			{#if shouldShowControls}
				{#if isRunning}
					<Button
						kind="danger"
						size="small"
						disabled={isTransitioning}
						on:click={() => onStop?.()}>Stop</Button
					>
				{:else}
					<Button
						kind="primary"
						size="small"
						disabled={isTransitioning}
						on:click={() => onStart?.()}>Start</Button
					>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.tool-card {
		padding: var(--cds-spacing-04);
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: var(--cds-spacing-03);
		transition: border-color 0.15s ease;
	}

	.tool-card.isRunning {
		border-color: var(--cds-border-subtle);
	}

	.tool-card.not-installed {
		opacity: 0.6;
	}

	.tool-card.not-installed .tool-name {
		color: var(--cds-text-secondary);
	}

	.tool-header {
		display: flex;
		align-items: center;
		gap: var(--cds-spacing-04);
	}

	.tool-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--cds-text-secondary);
	}

	.tool-card.isRunning .tool-icon {
		color: var(--cds-link-primary);
	}

	.tool-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tool-name {
		font-size: var(--cds-label-01-font-size);
		font-weight: 500;
		color: var(--cds-text-primary);
	}

	.tool-status-row {
		display: flex;
		align-items: center;
		gap: var(--cds-spacing-03);
	}

	.tool-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-active {
		background: var(--cds-support-success);
		box-shadow: 0 0 4px color-mix(in srgb, var(--cds-support-success) 50%, transparent);
	}

	.dot-transition {
		background: var(--cds-support-warning);
		animation: pulse 1s infinite;
	}

	.dot-stopped {
		background: var(--cds-text-secondary);
	}

	.tool-status-label {
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-secondary);
		letter-spacing: 0.025em;
	}

	.tool-count {
		font-family: var(--cds-code-01-font-family);
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-link-primary);
		font-variant-numeric: tabular-nums;
		margin-left: auto;
	}

	.tool-description {
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-secondary);
		line-height: 1.4;
		margin: 0;
	}

	.installation-badge {
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-secondary);
		padding: 2px var(--cds-spacing-03);
		border: 1px dashed var(--cds-border-subtle);
		border-radius: 4px;
	}

	.tool-actions {
		display: flex;
		gap: var(--cds-spacing-03);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
