<!--
	Session selector dropdown for the RF visualization. Fetches the
	list of known capture sessions from /api/sessions and lets the
	operator scope all RF layers (heatmap / drive path / centroids)
	to a single session. "All sessions" = null filter (server returns
	union across the whole `signals` table).

	Changing the selection kicks off rfVisualization.setSession() which
	updates filters + triggers a reload. The store's LRU cache handles
	repeat selections cheaply.
-->
<script lang="ts">
	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';

	// Load sessions once on mount. loadSessions() is idempotent — subsequent
	// calls no-op if sessionsLoaded is true.
	$effect(() => {
		if (!rfVisualization.sessionsLoaded) {
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
</script>

<div class="session-selector">
	<label class="session-label" for="rf-session-select">SESSION</label>
	<select
		id="rf-session-select"
		class="session-select"
		value={rfVisualization.activeSessionId ?? ''}
		onchange={handleChange}
		disabled={!rfVisualization.sessionsLoaded}
	>
		<option value="">All sessions</option>
		{#each rfVisualization.sessionsList as session (session.id)}
			<option value={session.id}>{labelFor(session)}</option>
		{/each}
	</select>
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
		color: var(--muted-foreground, #888);
	}
	.session-select {
		background: var(--card, #1a1a1a);
		color: var(--foreground, #e6e6e6);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 4px;
		padding: 0.35em 0.5em;
		font-size: 0.85em;
		font-family: inherit;
	}
	.session-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
