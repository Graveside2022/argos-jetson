<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import Button from '$lib/components/ui/button/button.svelte';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';
	import WebtakVncViewer from './webtak/webtak-vnc-viewer.svelte';

	type ServiceStatus = 'checking' | 'starting' | 'running' | 'stopped' | 'error';

	let serviceStatus = $state<ServiceStatus>('checking');
	let errorMsg = $state('');
	let wsUrl = $state('');
	let vncKey = $state(0);
	let stopping = $state(false);

	function buildWsUrl(wsPort: number, wsPath: string): string {
		const host = window.location.hostname;
		const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
		return `${proto}://${host}:${wsPort}${wsPath}`;
	}

	function extractReason(data: Record<string, unknown>): string {
		const err = data.error as string | undefined;
		if (err) return err;
		const msg = data.message as string | undefined;
		return msg ?? '';
	}

	function applyResultData(data: Record<string, unknown>): void {
		const isRunning = Boolean(data.isRunning ?? data.success);
		const wsPortVal = data.wsPort as number | undefined;
		const wsPathVal = data.wsPath as string | undefined;
		if (isRunning && wsPortVal && wsPathVal) {
			wsUrl = buildWsUrl(wsPortVal, wsPathVal);
			serviceStatus = 'running';
			return;
		}
		serviceStatus = 'stopped';
		errorMsg = extractReason(data);
	}

	async function postControl(action: 'start' | 'stop' | 'status'): Promise<Response> {
		return fetch('/api/wireshark/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ action })
		});
	}

	async function startCapture(): Promise<void> {
		serviceStatus = 'starting';
		try {
			const res = await postControl('start');
			if (!res.ok) {
				serviceStatus = 'error';
				errorMsg = `Start failed: ${res.status}`;
				return;
			}
			applyResultData(await res.json());
		} catch {
			serviceStatus = 'error';
			errorMsg = 'Failed to start Wireshark';
		}
	}

	function handleDisconnect(reason: string): void {
		if (reason === 'unclean') {
			serviceStatus = 'error';
			errorMsg = 'VNC connection lost';
		}
	}

	function reconnect(): void {
		vncKey++;
		void startCapture();
	}

	function goBack(): void {
		activeView.set('map');
	}

	async function handleStop(): Promise<void> {
		if (stopping) return;
		stopping = true;
		try {
			const res = await postControl('stop');
			if (!res.ok) {
				serviceStatus = 'error';
				errorMsg = `Stop failed: ${res.status}`;
				return;
			}
			activeView.set('map');
		} catch (err) {
			serviceStatus = 'error';
			errorMsg = `Stop failed: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			stopping = false;
		}
	}

	onMount(() => {
		void startCapture();
	});

	onDestroy(() => {
		void postControl('stop').catch(() => undefined);
	});
</script>

{#snippet stopAction()}
	<Button variant="outline" size="sm" onclick={handleStop} disabled={stopping}>
		{stopping ? 'Stopping…' : 'Stop'}
	</Button>
{/snippet}

<ToolViewWrapper title="Wireshark Protocol Analyzer" onBack={goBack} actions={stopAction}>
	{#if serviceStatus === 'checking' || serviceStatus === 'starting'}
		<div class="wireshark-status">
			<div class="spinner" aria-hidden="true"></div>
			<p class="status-label">
				{serviceStatus === 'starting' ? 'LAUNCHING WIRESHARK…' : 'CONNECTING…'}
			</p>
			<p class="status-detail">Capturing on interface "any" with filter "not arp"</p>
		</div>
	{:else if serviceStatus === 'stopped'}
		<div class="wireshark-status">
			<p class="status-label">WIRESHARK UNAVAILABLE</p>
			<p class="status-detail">{errorMsg || 'Service not running'}</p>
			<button class="retry-btn" onclick={reconnect}>START CAPTURE</button>
		</div>
	{:else if serviceStatus === 'error'}
		<div class="wireshark-status">
			<p class="status-label error">CONNECTION FAILED</p>
			<p class="status-detail">{errorMsg || 'Unknown error'}</p>
			<button class="retry-btn" onclick={reconnect}>RETRY</button>
		</div>
	{:else}
		{#key vncKey}
			<WebtakVncViewer {wsUrl} onDisconnect={handleDisconnect} resizeSession={true} />
		{/key}
	{/if}
</ToolViewWrapper>

<style>
	.wireshark-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.5rem;
	}
	.status-label {
		font-family: 'Fira Code', monospace;
		font-size: 12px;
		color: var(--muted-foreground, #d4a054);
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}
	.status-label.error {
		color: var(--destructive, #ff5c33);
	}
	.status-detail {
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		color: var(--muted-foreground, #888);
	}
	.retry-btn {
		margin-top: 0.5rem;
		padding: 0.35rem 1rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--primary, #a8b8e0);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 4px;
		background: var(--card, #1a1a1a);
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.retry-btn:hover {
		border-color: var(--primary, #a8b8e0);
	}
	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--border, #2e2e2e);
		border-top-color: var(--primary, #a8b8e0);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
