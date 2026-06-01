<script lang="ts" module>
	export type PanelStatusState = 'loading' | 'error' | 'empty' | 'disconnected' | 'disabled';
</script>

<script lang="ts">
	import { Button, InlineLoading } from 'carbon-components-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		state: PanelStatusState;
		title: string;
		detail?: string;
		icon?: Snippet;
		onRetry?: () => void;
		retryLabel?: string;
		action?: Snippet;
		class?: string;
	}

	let {
		state,
		title,
		detail,
		icon,
		onRetry,
		retryLabel = 'RETRY',
		action,
		class: className
	}: Props = $props();

	const showRetryButton = $derived(
		!action && (state === 'error' || state === 'disconnected') && onRetry !== undefined
	);
</script>

<div
	class="panel-status panel-status--{state} {className ?? ''}"
	role="status"
	aria-live="polite"
	aria-busy={state === 'loading'}
>
	{#if icon}
		<div class="panel-status__icon" aria-hidden="true">
			{@render icon()}
		</div>
	{:else if state === 'loading'}
		<InlineLoading />
	{/if}

	<p class="panel-status__title">{title}</p>

	{#if detail}
		<p class="panel-status__detail">{detail}</p>
	{/if}

	{#if action}
		<div class="panel-status__action">{@render action()}</div>
	{:else if showRetryButton}
		<Button kind="tertiary" size="small" on:click={() => onRetry?.()}>{retryLabel}</Button>
	{/if}
</div>

<style>
	.panel-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--cds-spacing-03);
		padding: var(--cds-spacing-06) var(--cds-spacing-05);
		min-height: 120px;
		text-align: center;
		font-family: var(--cds-code-01-font-family);
	}

	.panel-status__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: var(--cds-text-helper);
	}

	.panel-status__title {
		margin: 0;
		font-size: var(--cds-label-01-font-size);
		font-weight: 500;
		letter-spacing: 0.2px;
		color: var(--cds-text-primary);
	}

	.panel-status--error .panel-status__title,
	.panel-status--disconnected .panel-status__title {
		color: var(--cds-support-error);
	}

	.panel-status--disabled .panel-status__title {
		color: var(--cds-text-helper);
	}

	.panel-status__detail {
		margin: 0;
		max-width: 32ch;
		font-size: var(--cds-label-01-font-size);
		line-height: 1.45;
		color: var(--cds-text-helper);
	}

	.panel-status__action {
		margin-top: 4px;
	}
</style>
