<!--
  TAK server connection status and connect/disconnect controls.
  Extracted from TakConfigView.svelte to comply with Article 2.2 (max 300 lines/file).
-->
<script lang="ts">
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

<div class="rounded-lg border border-border/60 bg-card/40 p-3">
	<span class="mb-2 block text-xs font-semibold tracking-widest text-muted-foreground"
		>STATUS</span
	>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 text-xs">
			<span
				class="size-2.5 shrink-0 rounded-full {takStore.status.status === 'connected'
					? 'bg-green-500 shadow-[0_0_6px_theme(colors.green.500)]'
					: takStore.status.status === 'error'
						? 'bg-destructive'
						: 'bg-muted-foreground'}"
			></span>
			<span class="font-semibold text-foreground">{takStore.status.status.toUpperCase()}</span
			>
			{#if takStore.status.serverHost}
				<span class="text-muted-foreground">{takStore.status.serverHost}:{port}</span>
			{/if}
		</div>
		<div>
			{#if takStore.status.status === 'connected'}
				<button
					onclick={onDisconnect}
					disabled={isConnecting}
					class="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/40 disabled:opacity-50"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
							x1="12"
							y1="2"
							x2="12"
							y2="12"
						/></svg
					>
					{isConnecting ? 'Disconnecting...' : 'Disconnect'}
				</button>
			{:else}
				<button
					onclick={onConnect}
					disabled={isConnecting || !hasHostname}
					class="inline-flex items-center gap-1.5 rounded-md border border-green-500/50 bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/40 disabled:opacity-50"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
							x1="12"
							y1="2"
							x2="12"
							y2="12"
						/></svg
					>
					{isConnecting ? 'Connecting...' : 'Connect'}
				</button>
			{/if}
		</div>
	</div>

	{#if takStore.status.status === 'connected' && takStore.status.saBroadcast?.broadcasting}
		<div class="mt-2 flex items-center gap-2 border-t border-border/40 pt-2">
			<span class="relative flex size-2">
				<span
					class="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75"
				></span>
				<span class="relative inline-flex size-2 rounded-full bg-green-500"></span>
			</span>
			<span class="font-mono text-[10px] text-green-400">BROADCASTING TO NETWORK</span>
			<span class="ml-auto font-mono text-[10px] text-muted-foreground">
				{#if takStore.status.saBroadcast.lastBroadcastAt}
					Last: {new Date(takStore.status.saBroadcast.lastBroadcastAt).toLocaleTimeString(
						'en-US',
						{
							hour12: false,
							timeZone: 'UTC'
						}
					)}Z
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
