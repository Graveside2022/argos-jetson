<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import Button from '$lib/components/ui/button/button.svelte';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

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
	let captureIface = $state<string | null>(null);
	let captureFilter = $state<string | null>(null);
	let vncKey = $state(0);
	let stopping = $state(false);
	// Set once handleStop issues POST('stop'); onDestroy skips its fallback when true.
	let stopSent = $state(false);

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

	function isUnrecoverable(reason: string): boolean {
		return /not in the 'wireshark' group|Invalid Wireshark display filter/i.test(reason);
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
			captureIface = (data.iface as string | undefined) ?? null;
			captureFilter = (data.filter as string | undefined) ?? null;
			serviceStatus = 'running';
			return;
		}
		const reason = extractReason(data);
		errorMsg = reason;
		serviceStatus = isUnrecoverable(reason) ? 'disabled' : 'stopped';
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
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				const reason = extractReason(body) || `Start failed: ${res.status}`;
				errorMsg = reason;
				serviceStatus = isUnrecoverable(reason) ? 'disabled' : 'error';
				return;
			}
			applyResultData(await res.json());
		} catch (err) {
			serviceStatus = 'error';
			errorMsg = `Failed to start Wireshark: ${errorDetail(err)}`;
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
				// Do NOT latch stopSent — leave onDestroy's fallback armed so
				// the stack still gets a teardown attempt when the user leaves.
				serviceStatus = 'error';
				errorMsg = `Stop failed: ${res.status}`;
				return;
			}
			stopSent = true;
			activeView.set('map');
		} catch (err) {
			serviceStatus = 'error';
			errorMsg = `Stop failed: ${errorDetail(err)}`;
		} finally {
			stopping = false;
		}
	}

	onMount(() => {
		void startCapture();
	});

	onDestroy(() => {
		// handleStop already issued the stop request; skip to avoid a redundant
		// kill-all against an already-torn-down stack (races fuser -k + re-bind).
		if (stopSent) return;
		void postControl('stop').catch(() => undefined);
	});
</script>

{#snippet stopAction()}
	<Button variant="outline" size="sm" onclick={handleStop} disabled={stopping}>
		{stopping ? 'Stopping…' : 'Stop'}
	</Button>
{/snippet}

<ToolViewWrapper title="Wireshark Protocol Analyzer" onBack={goBack} actions={stopAction}>
	{#if serviceStatus === 'idle'}
		<div class="wireshark-status">
			<p class="status-label">WIRESHARK READY</p>
			<p class="status-detail">Initializing capture session…</p>
		</div>
	{:else if serviceStatus === 'checking' || serviceStatus === 'starting'}
		<div class="wireshark-status">
			<div class="spinner" aria-hidden="true"></div>
			<p class="status-label">
				{serviceStatus === 'starting' ? 'LAUNCHING WIRESHARK…' : 'CONNECTING…'}
			</p>
			<p class="status-detail">Spawning Xtigervnc + Wireshark Qt frontend + websockify</p>
		</div>
	{:else if serviceStatus === 'stopped'}
		<div class="wireshark-status">
			<p class="status-label">WIRESHARK UNAVAILABLE</p>
			<p class="status-detail">{errorMsg || 'Service not running'}</p>
			<button class="retry-btn" onclick={reconnect}>START CAPTURE</button>
		</div>
	{:else if serviceStatus === 'disabled'}
		<div class="wireshark-status">
			<p class="status-label error">WIRESHARK DISABLED</p>
			<p class="status-detail">{errorMsg || 'Preflight failed'}</p>
			<p class="status-hint">Resolve the issue above, then return to this view.</p>
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
		{#if captureIface || captureFilter}
			<div class="capture-ribbon">
				<span>iface: <code>{captureIface ?? 'any'}</code></span>
				<span>filter: <code>{captureFilter ?? '(none)'}</code></span>
			</div>
		{/if}
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
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}
	.status-label.error {
		color: var(--destructive);
	}
	.status-detail {
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		color: var(--muted-foreground);
		max-width: 40rem;
		text-align: center;
	}
	.status-hint {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: var(--muted-foreground);
	}
	.capture-ribbon {
		position: absolute;
		bottom: 0.5rem;
		left: 0.5rem;
		display: flex;
		gap: 1rem;
		padding: 0.25rem 0.5rem;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 3px;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: var(--muted-foreground);
	}
	.capture-ribbon code {
		color: var(--primary);
	}
	.retry-btn {
		margin-top: 0.5rem;
		padding: 0.35rem 1rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--primary);
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--card);
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.retry-btn:hover {
		border-color: var(--primary);
	}
	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
