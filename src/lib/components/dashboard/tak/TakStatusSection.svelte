<!--
  TAK server connection status and connect/disconnect controls.
  Extracted from TakConfigView.svelte to comply with Article 2.2 (max 300 lines/file).
-->
<script lang="ts">
	import Power from 'carbon-icons-svelte/lib/Power.svelte';

	import { takStore } from '$lib/stores/tak-store.svelte';

	interface Props {
		port: number;
		isConnecting: boolean;
		onConnect: () => void;
		onDisconnect: () => void;
		hasHostname: boolean;
	}

	let { port, isConnecting, onConnect, onDisconnect, hasHostname }: Props = $props();
</script>

<div class="tak-section">
	<span class="tak-label">STATUS</span>
	<div class="status-row">
		<div class="status-info">
			<span
				class="status-dot"
				class:dot-connected={takStore.status.status === 'connected'}
				class:dot-error={takStore.status.status === 'error'}
			></span>
			<span class="status-name">{takStore.status.status.toUpperCase()}</span>
			{#if takStore.status.serverHost}
				<span class="status-host">{takStore.status.serverHost}:{port}</span>
			{/if}
		</div>
		<div>
			{#if takStore.status.status === 'connected'}
				<button class="conn-btn conn-disconnect" onclick={onDisconnect} disabled={isConnecting}>
					<Power size={14} />
					{isConnecting ? 'Disconnecting...' : 'Disconnect'}
				</button>
			{:else}
				<button
					class="conn-btn conn-connect"
					onclick={onConnect}
					disabled={isConnecting || !hasHostname}
				>
					<Power size={14} />
					{isConnecting ? 'Connecting...' : 'Connect'}
				</button>
			{/if}
		</div>
	</div>

	{#if takStore.status.status === 'connected' && takStore.status.saBroadcast?.broadcasting}
		<div class="broadcast-row">
			<span class="ping">
				<span class="ping-halo"></span>
				<span class="ping-core"></span>
			</span>
			<span class="broadcast-label">BROADCASTING TO NETWORK</span>
			<span class="broadcast-meta">
				{#if takStore.status.saBroadcast.lastBroadcastAt}
					Last: {new Date(takStore.status.saBroadcast.lastBroadcastAt).toLocaleTimeString('en-US', {
						hour12: false,
						timeZone: 'UTC'
					})}Z
				{:else}
					Waiting for GPS...
				{/if}
				{#if takStore.status.saBroadcast.broadcastCount > 0}
					&middot; {takStore.status.saBroadcast.broadcastCount} sent
				{/if}
			</span>
		</div>
	{/if}
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

	.status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.status-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	.status-dot {
		width: 0.625rem;
		height: 0.625rem;
		flex-shrink: 0;
		border-radius: 9999px;
		background: var(--cds-text-helper);
	}

	.status-dot.dot-connected {
		background: var(--cds-support-success);
		box-shadow: 0 0 6px var(--cds-support-success);
	}

	.status-dot.dot-error {
		background: var(--cds-support-error);
	}

	.status-name {
		font-weight: 600;
		color: var(--cds-text-primary);
	}

	.status-host {
		color: var(--cds-text-helper);
	}

	.conn-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border-radius: 0.375rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.conn-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.conn-disconnect {
		border: 1px solid color-mix(in srgb, var(--cds-support-error) 50%, transparent);
		background: color-mix(in srgb, var(--cds-support-error) 20%, transparent);
		color: var(--cds-support-error);
	}

	.conn-disconnect:hover {
		background: color-mix(in srgb, var(--cds-support-error) 40%, transparent);
	}

	.conn-connect {
		border: 1px solid color-mix(in srgb, var(--cds-support-success) 50%, transparent);
		background: color-mix(in srgb, var(--cds-support-success) 20%, transparent);
		color: var(--cds-support-success);
	}

	.conn-connect:hover {
		background: color-mix(in srgb, var(--cds-support-success) 40%, transparent);
	}

	.broadcast-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--cds-border-subtle) 40%, transparent);
	}

	.ping {
		position: relative;
		display: flex;
		width: 0.5rem;
		height: 0.5rem;
	}

	.ping-halo {
		position: absolute;
		display: inline-flex;
		width: 100%;
		height: 100%;
		border-radius: 9999px;
		background: var(--cds-support-success);
		opacity: 0.75;
		animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
	}

	.ping-core {
		position: relative;
		display: inline-flex;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 9999px;
		background: var(--cds-support-success);
	}

	@keyframes ping {
		75%,
		100% {
			transform: scale(2);
			opacity: 0;
		}
	}

	.broadcast-label {
		font-family: var(--cds-code-01-font-family);
		font-size: 0.625rem;
		color: var(--cds-support-success);
	}

	.broadcast-meta {
		margin-left: auto;
		font-family: var(--cds-code-01-font-family);
		font-size: 0.625rem;
		color: var(--cds-text-helper);
	}
</style>
