<script lang="ts">
	import InProgress from 'carbon-icons-svelte/lib/InProgress.svelte';
	import Misuse from 'carbon-icons-svelte/lib/Misuse.svelte';
	import Plug from 'carbon-icons-svelte/lib/Plug.svelte';
	import Security from 'carbon-icons-svelte/lib/Security.svelte';

	import { gpStatus } from '$lib/stores/globalprotect-store.svelte';

	interface Props {
		isConnecting: boolean;
		hasPortal: boolean;
		onconnect: () => void;
	}

	let { isConnecting, hasPortal, onconnect }: Props = $props();
</script>

<div class="gp-status-card">
	<div class="status-head">
		<div class="icon-col">
			{#if gpStatus.current.status === 'connected'}
				<div class="icon-box icon-connected">
					<Security size={20} />
				</div>
			{:else if gpStatus.current.status === 'connecting' || isConnecting}
				<div class="icon-box icon-connecting">
					<InProgress size={20} class="gp-spin" />
				</div>
			{:else if gpStatus.current.status === 'error'}
				<div class="icon-box icon-error">
					<Misuse size={20} />
				</div>
			{:else}
				<div class="icon-box icon-default">
					<Security size={20} />
				</div>
			{/if}
		</div>

		<div class="status-body">
			<div class="status-row">
				<div>
					<span class="status-name">
						{#if gpStatus.current.status === 'connected'}
							VPN Connected
						{:else if gpStatus.current.status === 'connecting' || isConnecting}
							Establishing Connection
						{:else if gpStatus.current.status === 'error'}
							Connection Failed
						{:else}
							VPN Disconnected
						{/if}
					</span>
					{#if gpStatus.current.portal}
						<p class="status-portal">{gpStatus.current.portal}</p>
					{/if}
				</div>

				{#if !isConnecting && gpStatus.current.status !== 'connecting' && gpStatus.current.status !== 'connected'}
					<button class="connect-btn" disabled={!hasPortal} onclick={onconnect}>
						<Plug size={12} />
						Connect
					</button>
				{/if}
			</div>

			{#if gpStatus.current.status === 'connected'}
				<div class="status-meta">
					{#if gpStatus.current.assignedIp}
						<div class="meta-col">
							<span class="meta-label">Assigned IP</span>
							<span class="meta-val">{gpStatus.current.assignedIp}</span>
						</div>
					{/if}
				</div>
			{/if}

			{#if gpStatus.current.lastError}
				<p class="status-error-text">{gpStatus.current.lastError}</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.gp-status-card {
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 60%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--cds-layer) 40%, transparent);
	}

	.status-head {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.icon-col {
		margin-top: 0.125rem;
	}

	.icon-box {
		display: flex;
		width: 2.5rem;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		border: 1px solid transparent;
	}

	.icon-connected {
		background: color-mix(in srgb, var(--cds-support-success) 15%, transparent);
		border-color: color-mix(in srgb, var(--cds-support-success) 30%, transparent);
		color: var(--cds-support-success);
	}

	.icon-connecting {
		background: color-mix(in srgb, var(--cds-link-primary) 15%, transparent);
		border-color: color-mix(in srgb, var(--cds-link-primary) 30%, transparent);
		color: var(--cds-link-primary);
	}

	.icon-error {
		background: color-mix(in srgb, var(--cds-support-error) 15%, transparent);
		border-color: color-mix(in srgb, var(--cds-support-error) 30%, transparent);
		color: var(--cds-support-error);
	}

	.icon-default {
		background: color-mix(in srgb, var(--cds-layer) 30%, transparent);
		border-color: color-mix(in srgb, var(--cds-border-subtle) 40%, transparent);
		color: var(--cds-text-helper);
	}

	.icon-connecting :global(.gp-spin) {
		animation: gp-spin 1s linear infinite;
	}

	@keyframes gp-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.status-body {
		flex: 1;
		min-width: 0;
	}

	.status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.status-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--cds-text-primary);
	}

	.status-portal {
		margin-top: 0.125rem;
		font-size: 0.75rem;
		color: var(--cds-text-helper);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.connect-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border: 1px solid color-mix(in srgb, var(--cds-support-success) 50%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--cds-support-success) 20%, transparent);
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--cds-support-success);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.connect-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cds-support-success) 30%, transparent);
	}

	.connect-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-meta {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
		font-size: 0.75rem;
	}

	.meta-col {
		display: flex;
		flex-direction: column;
	}

	.meta-label {
		color: var(--cds-text-helper);
	}

	.meta-val {
		font-weight: 500;
		color: var(--cds-text-primary);
	}

	.status-error-text {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--cds-support-error);
	}
</style>
