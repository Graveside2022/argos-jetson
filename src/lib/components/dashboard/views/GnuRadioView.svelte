<script lang="ts">
	import { Button, InlineLoading } from 'carbon-components-svelte';
	import { onMount } from 'svelte';

	import { activeView } from '$lib/stores/dashboard/dashboard-store.svelte';

	import ToolViewWrapper from './ToolViewWrapper.svelte';
	import WebtakVncViewer from './webtak/webtak-vnc-viewer.svelte';

	type ServiceStatus =
		| 'idle'
		| 'checking'
		| 'starting'
		| 'running'
		| 'stopped'
		| 'error'
		| 'disabled';

	let serviceStatus = $state<ServiceStatus>('idle');
	let errorMsg = $state('');
	let wsUrl = $state('');
	let currentFlowgraph = $state<string | null>(null);
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

	function errorDetail(err: unknown): string {
		return err instanceof Error ? err.message : String(err);
	}

	function getRunningWsUrl(data: Record<string, unknown>): string | null {
		const isRunning = Boolean(data.isRunning ?? data.success);
		const wsPortVal = data.wsPort as number | undefined;
		const wsPathVal = data.wsPath as string | undefined;
		if (!isRunning || !wsPortVal || !wsPathVal) return null;
		return buildWsUrl(wsPortVal, wsPathVal);
	}

	function applyResultData(data: Record<string, unknown>): void {
		const url = getRunningWsUrl(data);
		if (url) {
			wsUrl = url;
			currentFlowgraph = (data.flowgraph as string | undefined) ?? null;
			serviceStatus = 'running';
			return;
		}
		errorMsg = extractReason(data);
		serviceStatus = 'stopped';
	}

	async function postControl(action: 'start' | 'stop' | 'status'): Promise<Response> {
		return fetch('/api/gnuradio/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ action })
		});
	}

	async function startGrc(): Promise<void> {
		serviceStatus = 'starting';
		try {
			const res = await postControl('start');
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMsg = extractReason(body) || `Start failed: ${res.status}`;
				serviceStatus = 'error';
				return;
			}
			applyResultData(await res.json());
		} catch (err) {
			serviceStatus = 'error';
			errorMsg = `Failed to start GNU Radio: ${errorDetail(err)}`;
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
		void startGrc();
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
			errorMsg = `Stop failed: ${errorDetail(err)}`;
		} finally {
			stopping = false;
		}
	}

	onMount(() => {
		void startGrc();
	});
</script>

{#snippet stopAction()}
	<Button kind="tertiary" size="small" on:click={handleStop} disabled={stopping}>
		{stopping ? 'Stopping…' : 'Stop'}
	</Button>
{/snippet}

<ToolViewWrapper title="GNU Radio Companion" onBack={goBack} actions={stopAction}>
	{#if serviceStatus === 'idle'}
		<div class="grc-status">
			<p class="status-label">GNU RADIO READY</p>
			<p class="status-detail">Initializing flowgraph editor…</p>
		</div>
	{:else if serviceStatus === 'checking' || serviceStatus === 'starting'}
		<div class="grc-status">
			<InlineLoading
				description={serviceStatus === 'starting' ? 'LAUNCHING GNU RADIO…' : 'CONNECTING…'}
			/>
			<p class="status-detail">Spawning Xtigervnc + gnuradio-companion + websockify</p>
		</div>
	{:else if serviceStatus === 'stopped'}
		<div class="grc-status">
			<p class="status-label">GNU RADIO UNAVAILABLE</p>
			<p class="status-detail">{errorMsg || 'Service not running'}</p>
			<Button kind="primary" size="small" on:click={reconnect}>START GNU RADIO</Button>
		</div>
	{:else if serviceStatus === 'disabled'}
		<div class="grc-status">
			<p class="status-label error">GNU RADIO DISABLED</p>
			<p class="status-detail">{errorMsg || 'Preflight failed'}</p>
			<p class="status-hint">Resolve the issue above, then return to this view.</p>
		</div>
	{:else if serviceStatus === 'error'}
		<div class="grc-status">
			<p class="status-label error">CONNECTION FAILED</p>
			<p class="status-detail">{errorMsg || 'Unknown error'}</p>
			<Button kind="primary" size="small" on:click={reconnect}>RETRY</Button>
		</div>
	{:else}
		{#key vncKey}
			<WebtakVncViewer {wsUrl} onDisconnect={handleDisconnect} resizeSession={true} />
		{/key}
		{#if currentFlowgraph}
			<div class="flowgraph-ribbon">
				<span>flowgraph: <code>{currentFlowgraph}</code></span>
			</div>
		{/if}
	{/if}
</ToolViewWrapper>

<style>
	.grc-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.5rem;
	}
	.status-label {
		font-family: var(--cds-code-01-font-family);
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-helper);
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}
	.status-label.error {
		color: var(--cds-support-error);
	}
	.status-detail {
		font-family: var(--cds-code-01-font-family);
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-helper);
		max-width: 40rem;
		text-align: center;
	}
	.status-hint {
		font-family: var(--cds-code-01-font-family);
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-helper);
	}
	.flowgraph-ribbon {
		position: absolute;
		bottom: 0.5rem;
		left: 0.5rem;
		display: flex;
		gap: 1rem;
		padding: 0.25rem 0.5rem;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 3px;
		font-family: var(--cds-code-01-font-family);
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-helper);
	}
	.flowgraph-ribbon code {
		color: var(--cds-link-primary);
	}
</style>
