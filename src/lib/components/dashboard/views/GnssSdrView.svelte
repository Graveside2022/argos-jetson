<script lang="ts">
	import { onMount } from 'svelte';

	import PanelStatus from '$lib/components/chassis/PanelStatus.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { activeView } from '$lib/stores/dashboard/dashboard-store.svelte';

	import ToolViewWrapper from './ToolViewWrapper.svelte';
	import { buildWsUrl } from './vnc-tool-view-helpers';
	import WebtakVncViewer from './webtak/webtak-vnc-viewer.svelte';

	type ServiceStatus = 'checking' | 'stopped' | 'starting' | 'running' | 'error';

	let serviceStatus = $state<ServiceStatus>('checking');
	let errorMsg = $state('');
	let wsUrl = $state('');
	let vncKey = $state(0);
	let stopping = $state(false);
	let starting = $state(false);

	interface StatusResponse {
		isRunning?: boolean;
		wsPort?: number;
		wsPath?: string;
	}

	interface ControlResponse {
		success: boolean;
		message?: string;
		error?: string;
		wsPort?: number;
		wsPath?: string;
	}

	function applyStatusData(data: StatusResponse): void {
		if (data.isRunning && data.wsPort && data.wsPath) {
			wsUrl = buildWsUrl(data.wsPort, data.wsPath);
			serviceStatus = 'running';
		} else {
			serviceStatus = 'stopped';
			wsUrl = '';
		}
	}

	async function postControl(action: 'start' | 'stop' | 'status'): Promise<ControlResponse> {
		const res = await fetch('/api/gnss-sdr/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ action })
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return (await res.json()) as ControlResponse;
	}

	async function checkStatus(): Promise<void> {
		try {
			const data = await postControl('status');
			applyStatusData(data as StatusResponse);
		} catch {
			serviceStatus = 'error';
			errorMsg = 'Failed to query GNSS-SDR status';
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
		serviceStatus = 'checking';
		void checkStatus();
	}

	function goBack(): void {
		activeView.set('map');
	}

	// eslint-disable-next-line complexity
	function applyStartResult(data: ControlResponse): void {
		if (data.success && data.wsPort && data.wsPath) {
			wsUrl = buildWsUrl(data.wsPort, data.wsPath);
			serviceStatus = 'running';
			return;
		}
		serviceStatus = 'error';
		errorMsg = data.error ?? data.message ?? 'Failed to start GNSS-SDR';
	}

	async function handleStart(): Promise<void> {
		if (starting) return;
		starting = true;
		serviceStatus = 'starting';
		errorMsg = '';
		try {
			applyStartResult(await postControl('start'));
		} catch (err) {
			serviceStatus = 'error';
			errorMsg = `Start failed: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			starting = false;
		}
	}

	async function handleStop(): Promise<void> {
		if (stopping) return;
		stopping = true;
		try {
			await postControl('stop');
			serviceStatus = 'stopped';
			wsUrl = '';
		} catch (err) {
			serviceStatus = 'error';
			errorMsg = `Stop failed: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			stopping = false;
		}
	}

	onMount(() => {
		void checkStatus();
	});
</script>

{#snippet actions()}
	{#if serviceStatus === 'running'}
		<Button variant="outline" size="sm" onclick={handleStop} disabled={stopping}>
			{stopping ? 'Stopping…' : 'Stop'}
		</Button>
	{/if}
{/snippet}

<ToolViewWrapper title="GNSS-SDR Receiver" onBack={goBack} {actions}>
	{#if serviceStatus === 'checking'}
		<PanelStatus state="loading" title="CHECKING GNSS-SDR..." />
	{:else if serviceStatus === 'stopped'}
		<div class="start-shell">
			<div class="start-card">
				<h3 class="start-title">SOFTWARE GNSS RECEIVER</h3>
				<p class="start-desc">
					Starts the B205mini-fed software GNSS receiver. Auto-detects the radio, tracks
					GPS L1 (1575.42&nbsp;MHz), opens the RTKLIB plot + navigation Qt GUIs in the
					panel, and bridges the position fix back into the system gpsd so the tactical
					map can fall over to the SDR fix if the hardware GPS is contested.
				</p>
				<ul class="start-list">
					<li>Constellation: GPS L1 only (4&nbsp;MS/s, ~70% CPU)</li>
					<li>Locks the B205 — other SDR tools blocked until you press Stop</li>
					<li>First fix typically &lt;120&nbsp;s outdoors with an active L1 antenna</li>
				</ul>
				<Button onclick={handleStart} disabled={starting}>
					{starting ? 'Starting…' : 'Start GNSS-SDR'}
				</Button>
			</div>
		</div>
	{:else if serviceStatus === 'starting'}
		<PanelStatus
			state="loading"
			title="STARTING GNSS-SDR..."
			detail="Spawning Xtigervnc, gnss-sdr, rtknavi_qt, rtkplot_qt, websockify, socat bridge."
		/>
	{:else if serviceStatus === 'error'}
		<PanelStatus
			state="error"
			title="GNSS-SDR FAILED"
			detail={errorMsg || 'Unknown error'}
			onRetry={reconnect}
		/>
	{:else}
		{#key vncKey}
			<WebtakVncViewer {wsUrl} onDisconnect={handleDisconnect} resizeSession={true} />
		{/key}
	{/if}
</ToolViewWrapper>

<style>
	.start-shell {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 24px;
		background: var(--background);
	}

	.start-card {
		background: var(--card);
		border: 1px solid var(--border);
		padding: 28px 32px;
		max-width: 560px;
		width: 100%;
		font-family: 'Fira Code', monospace;
	}

	.start-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--primary);
		margin: 0 0 12px;
		text-transform: uppercase;
	}

	.start-desc {
		font-size: 10px;
		line-height: 1.6;
		color: var(--text-secondary);
		margin: 0 0 16px;
	}

	.start-list {
		font-size: 10px;
		line-height: 1.7;
		color: var(--text-secondary);
		margin: 0 0 20px;
		padding-left: 16px;
	}

	.start-list li {
		margin-bottom: 4px;
	}
</style>
