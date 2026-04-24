<!--
	Session selector dropdown for the RF visualization. Fetches the
	list of known capture sessions from /api/sessions and lets the
	operator scope all RF layers (heatmap / drive path / centroids)
	to a single session. "All sessions" = null filter (server returns
	union across the whole `signals` table).

	Three visible states: Loading (in-flight fetch), Error (failed
	fetch with Retry), Ready (dropdown). Empty list is covered by
	the always-present "All sessions" option in Ready state.
-->
<script lang="ts">
	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';

	// Load sessions once on mount. Guard with sessionsLoading + sessionsLoadFailed
	// so the effect can't retry on its own — a transient network failure leaves
	// sessionsLoaded=false, which without a failure flag would let any future
	// dep change trigger another fetch. One shot per mount.
	$effect(() => {
		if (
			!rfVisualization.sessionsLoaded &&
			!rfVisualization.sessionsLoading &&
			!rfVisualization.sessionsLoadFailed
		) {
			void rfVisualization.loadSessions();
		}
	});

	function labelFor(s: { label: string | null; startedAt: number; id: string }): string {
		if (s.label) return s.label;
		if (s.startedAt === 0) return `legacy (pre-session data)`;
		return new Date(s.startedAt).toISOString().replace('T', ' ').slice(0, 16);
	}

	function handleChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		void rfVisualization.setSession(value === '' ? null : value);
	}

	function retryLoad(): void {
		void rfVisualization.loadSessions();
	}
</script>

<div class="session-selector">
	<label class="session-label" for="rf-session-select">SESSION</label>
	{#if rfVisualization.sessionsLoading}
		<div class="session-status">Loading sessions…</div>
	{:else if rfVisualization.sessionsLoadFailed}
		<div class="session-status session-error" role="alert">
			<span class="session-error-msg" title={rfVisualization.error ?? ''}>
				{rfVisualization.error ?? 'Failed to load sessions.'}
			</span>
			<button type="button" class="session-retry" onclick={retryLoad}>Retry</button>
		</div>
	{:else if rfVisualization.sessionsList.length === 0}
		<div class="session-status">
			No capture sessions yet. Start a Kismet scan to create one.
		</div>
	{:else}
		<select
			id="rf-session-select"
			class="session-select"
			value={rfVisualization.activeSessionId ?? ''}
			onchange={handleChange}
		>
			<option value="">All sessions</option>
			{#each rfVisualization.sessionsList as session (session.id)}
				<option value={session.id}>{labelFor(session)}</option>
			{/each}
		</select>
	{/if}
</div>

<style>
	.session-selector {
		display: flex;
		flex-direction: column;
		gap: 0.35em;
		padding: 0.5em 0.75em;
	}
	.session-label {
		font-size: 0.68em;
		letter-spacing: 0.08em;
		color: var(--muted-foreground);
	}
	.session-select {
		background: var(--card);
		color: var(--foreground);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.35em 0.5em;
		font-size: 0.85em;
		font-family: inherit;
	}
	.session-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.session-status {
		font-size: 0.78em;
		padding: 0.35em 0.5em;
		color: var(--muted-foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.session-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5em;
		color: var(--destructive);
		border-color: var(--destructive);
	}
	.session-error-msg {
		flex: 1 1 auto;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.session-retry {
		flex: 0 0 auto;
		background: transparent;
		color: inherit;
		border: 1px solid currentcolor;
		border-radius: 3px;
		padding: 0.15em 0.55em;
		font-family: inherit;
		font-size: 0.78em;
		cursor: pointer;
	}
	.session-retry:hover {
		background: var(--destructive);
		color: var(--destructive-foreground);
	}
</style>
