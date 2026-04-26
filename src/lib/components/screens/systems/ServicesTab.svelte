<script lang="ts">
	import { onMount } from 'svelte';

	import Dot from '$lib/components/mk2/Dot.svelte';

	// spec-024 PR4 T026 — SERVICES sub-tab. Wired to /api/system/services
	// because that endpoint already exists and the schema is stable. Other
	// sub-tabs (HW/PROC/NET) wait on their endpoints to be authored in PR5+.

	const POLL_MS = 4000;

	type HealthStatus = 'healthy' | 'degraded' | 'zombie' | 'stopped';

	interface ServiceRow {
		name: string;
		status: HealthStatus;
		process_running: boolean;
		port_listening: boolean;
		port: number;
		pid: number | null;
	}

	interface ServicesResponse {
		success: boolean;
		overall_health: 'healthy' | 'degraded';
		services: ServiceRow[];
		healthy_count: number;
		total_count: number;
	}

	let services = $state<ServiceRow[]>([]);
	let healthyCount = $state(0);
	let totalCount = $state(0);
	let lastError = $state<string | null>(null);
	let firstSampleArrived = $state(false);

	// CR fix #3 — explicit state envelope. Per CLAUDE.md component-state
	// contract, the template branches on a single derived value rather than
	// on a chain of falsy checks. Active = Default once rows flow; Disabled +
	// Disconnected collapse to Error because nothing in this tab can be
	// programmatically toggled — both reduce to "/api/system/services
	// unreachable" with the same recovery hint.
	type TabState = 'loading' | 'empty' | 'default' | 'error';
	const tabState = $derived<TabState>(
		!firstSampleArrived && lastError === null
			? 'loading'
			: lastError !== null && services.length === 0
				? 'error'
				: services.length === 0
					? 'empty'
					: 'default'
	);

	function dotKind(status: HealthStatus): 'ok' | 'warn' | 'err' | 'inactive' {
		if (status === 'healthy') return 'ok';
		if (status === 'degraded' || status === 'zombie') return 'warn';
		return 'inactive';
	}

	async function fetchServices(): Promise<void> {
		try {
			const res = await fetch('/api/system/services');
			if (!res.ok) throw new Error(`services ${res.status}`);
			const json: ServicesResponse = await res.json();
			services = json.services;
			healthyCount = json.healthy_count;
			totalCount = json.total_count;
			lastError = null;
			firstSampleArrived = true;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			firstSampleArrived = true;
		}
	}

	onMount(() => {
		void fetchServices();
		const id = window.setInterval(fetchServices, POLL_MS);
		return () => window.clearInterval(id);
	});
</script>

<div class="svc-tab" data-state={tabState}>
	<div class="summary mono">
		<span><span class="label">HEALTHY</span> {healthyCount}</span>
		<span><span class="label">TOTAL</span> {totalCount}</span>
		<span><span class="label">SOURCE</span> /api/system/services</span>
	</div>

	{#if tabState === 'loading'}
		<p class="loading mono" aria-live="polite">connecting to /api/system/services…</p>
	{:else if tabState === 'error'}
		<p class="err mono" role="alert">
			cannot reach /api/system/services — {lastError}. Check ARGOS_API_KEY +
			service status; retrying every {POLL_MS / 1000}s.
		</p>
	{:else if tabState === 'empty'}
		<p class="empty mono">no services configured server-side.</p>
	{:else}
		<table class="svc-table">
			<thead>
				<tr><th class="dot-col"></th><th>UNIT</th><th>STATE</th><th>PORT</th><th>PID</th></tr>
			</thead>
			<tbody>
				{#each services as svc (svc.name)}
					<tr>
						<td class="dot-col"><Dot kind={dotKind(svc.status)} label={svc.status} /></td>
						<td class="mono name">{svc.name}</td>
						<td class="mono state state-{svc.status}">{svc.status.toUpperCase()}</td>
						<td class="mono">{svc.port}</td>
						<td class="mono pid">{svc.pid ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if lastError}
			<p class="err mono" role="alert">last poll error: {lastError}</p>
		{/if}
	{/if}
</div>

<style>
	.svc-tab {
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		color: var(--mk2-ink);
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.summary {
		display: flex;
		gap: 24px;
		padding: 8px 10px;
		background: var(--mk2-bg-2);
		border: 1px solid var(--mk2-line);
		font-size: var(--mk2-fs-3);
	}

	.label {
		color: var(--mk2-ink-4);
		letter-spacing: 0.1em;
		margin-right: 6px;
		text-transform: uppercase;
	}

	.svc-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--mk2-fs-3);
	}

	.svc-table th {
		text-align: left;
		padding: 8px 10px;
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		letter-spacing: 0.12em;
		color: var(--mk2-ink-4);
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		text-transform: uppercase;
	}

	.svc-table td {
		padding: 6px 10px;
		border-bottom: 1px solid var(--mk2-line);
		vertical-align: middle;
	}

	.dot-col {
		width: 16px;
	}

	.name {
		color: var(--mk2-ink);
	}

	.state-healthy {
		color: var(--mk2-green);
	}
	.state-degraded,
	.state-zombie {
		color: var(--mk2-amber);
	}
	.state-stopped {
		color: var(--mk2-ink-4);
	}

	.pid {
		color: var(--mk2-ink-3);
	}

	.empty {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
	}

	.loading {
		font-size: var(--mk2-fs-3);
		color: var(--mk2-ink-3);
	}

	.err {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-red);
	}
</style>
