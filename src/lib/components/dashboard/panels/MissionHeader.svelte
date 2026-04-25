<!--
	PR-4 MissionHeader — Flying-Squirrel style mission metadata editor.
	Shows the active session's operator / asset / area with inline edit.
	Changes PATCH /api/sessions/:id on blur; stale values re-apply on
	external session switch.
-->
<script lang="ts">
	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';

	interface MissionFields {
		operatorId: string;
		assetId: string;
		areaName: string;
		notes: string;
	}

	const EMPTY_FIELDS: MissionFields = { operatorId: '', assetId: '', areaName: '', notes: '' };

	let fields = $state<MissionFields>({ ...EMPTY_FIELDS });
	let savedFields = $state<MissionFields>({ ...EMPTY_FIELDS });
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let loadedSessionId = $state<string | null>(null);
	// Tracks the in-flight PATCH so concurrent blur events serialize per-mission;
	// without this two overlapping PATCHes can resolve out of order, letting an
	// older response win and silently overwrite the operator's newer edits.
	let pendingSave: Promise<void> = Promise.resolve();

	type MissionResponse = {
		operatorId: string | null;
		assetId: string | null;
		areaName: string | null;
		notes: string | null;
	};

	async function fetchMission(id: string): Promise<MissionResponse> {
		const resp = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
			credentials: 'include'
		});
		if (!resp.ok) throw new Error(`GET /api/sessions/${id} ${resp.status}`);
		return (await resp.json()) as MissionResponse;
	}

	function applyMissionResponse(id: string, data: MissionResponse): void {
		const next: MissionFields = {
			operatorId: data.operatorId ?? '',
			assetId: data.assetId ?? '',
			areaName: data.areaName ?? '',
			notes: data.notes ?? ''
		};
		fields = { ...next };
		savedFields = { ...next };
		loadedSessionId = id;
	}

	function isStillActive(startId: string): boolean {
		return rfVisualization.activeSessionId === startId;
	}

	function formatError(err: unknown): string {
		return err instanceof Error ? err.message : String(err);
	}

	async function safeFetchMission(
		startId: string
	): Promise<{ data: MissionResponse | null; error: string | null }> {
		try {
			return { data: await fetchMission(startId), error: null };
		} catch (err) {
			return { data: null, error: formatError(err) };
		}
	}

	async function loadMetadata(id: string): Promise<void> {
		// Capture the session id at the START of the fetch. If the active
		// session changes mid-flight (e.g. operator clicks a different row in
		// the SessionSelector), discard the stale response so it doesn't
		// overwrite the newer session's metadata or surface a phantom error.
		const startId = id;
		saveError = null;
		const { data, error } = await safeFetchMission(startId);
		if (!isStillActive(startId)) return;
		if (data) applyMissionResponse(startId, data);
		else saveError = error;
	}

	$effect(() => {
		const id = rfVisualization.activeSessionId;
		if (!id) {
			// Disconnected — clear local state so the inputs don't show the
			// previous mission's metadata, and so persist() short-circuits even
			// if the user already started typing before the session ended.
			fields = { ...EMPTY_FIELDS };
			savedFields = { ...EMPTY_FIELDS };
			loadedSessionId = null;
			saveError = null;
			return;
		}
		if (loadedSessionId === id) return;
		void loadMetadata(id);
	});

	const disconnected = $derived(rfVisualization.activeSessionId === null);

	/**
	 * Build a minimal PATCH body containing only fields whose value differs
	 * from the last server-confirmed snapshot. Sending unchanged fields makes
	 * concurrent blur-triggered PATCHes overwrite each other; minimising the
	 * body limits the blast radius if ordering is still off.
	 */
	function buildPatchBody(): Record<string, string | null> {
		const body: Record<string, string | null> = {};
		(Object.keys(fields) as Array<keyof MissionFields>).forEach((k) => {
			if (fields[k] !== savedFields[k]) body[k] = fields[k] || null;
		});
		return body;
	}

	async function patchMission(id: string, body: Record<string, string | null>): Promise<void> {
		const resp = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!resp.ok) throw new Error(`PATCH /api/sessions/${id} ${resp.status}`);
	}

	async function attemptPatch(
		startId: string,
		body: Record<string, string | null>,
		snapshot: MissionFields
	): Promise<void> {
		try {
			await patchMission(startId, body);
			// Bail if the operator switched sessions during the request; the
			// server-side state for `startId` is updated, but our local
			// `savedFields` belongs to whatever the active session is now.
			if (rfVisualization.activeSessionId === startId) {
				savedFields = snapshot;
			}
		} catch (err) {
			saveError = err instanceof Error ? err.message : String(err);
		}
	}

	async function runPersist(startId: string): Promise<void> {
		// Re-check the active session immediately before issuing the PATCH —
		// if it changed (or was cleared) while we were queued, drop the write.
		if (rfVisualization.activeSessionId !== startId) return;
		const body = buildPatchBody();
		if (Object.keys(body).length === 0) return; // nothing changed
		// Snapshot what we're about to commit so a follow-up PATCH only sends
		// fields the user has touched again.
		const snapshot: MissionFields = { ...fields };
		saving = true;
		saveError = null;
		await attemptPatch(startId, body, snapshot);
		saving = false;
	}

	async function persist(): Promise<void> {
		const id = rfVisualization.activeSessionId;
		if (!id) return; // disconnected — short-circuit
		// Chain onto any pending save so writes serialize per session. Even if
		// the previous save rejected we still proceed (its error already lives
		// in `saveError`).
		const prev = pendingSave;
		pendingSave = (async () => {
			try {
				await prev;
			} catch {
				/* prior failure already surfaced */
			}
			await runPersist(id);
		})();
		return pendingSave;
	}
</script>

<div class="mission-header">
	<div class="label-row">
		<label class="mh-label" for="mh-operator">MISSION METADATA</label>
		{#if disconnected}
			<span class="mh-status" title="No active session — start one to edit">disconnected</span
			>
		{:else if saving}
			<span class="mh-status">saving…</span>
		{:else if saveError}
			<span class="mh-status mh-err" title={saveError}>error</span>
		{/if}
	</div>

	<div class="field">
		<label for="mh-operator">Operator</label>
		<input
			id="mh-operator"
			type="text"
			bind:value={fields.operatorId}
			onblur={() => void persist()}
			maxlength="64"
			placeholder={disconnected ? 'no active session' : 'call-sign'}
			disabled={disconnected}
		/>
	</div>
	<div class="field">
		<label for="mh-asset">Asset</label>
		<input
			id="mh-asset"
			type="text"
			bind:value={fields.assetId}
			onblur={() => void persist()}
			maxlength="64"
			placeholder={disconnected ? 'no active session' : 'e.g. TRK-04'}
			disabled={disconnected}
		/>
	</div>
	<div class="field">
		<label for="mh-area">Area</label>
		<input
			id="mh-area"
			type="text"
			bind:value={fields.areaName}
			onblur={() => void persist()}
			maxlength="128"
			placeholder={disconnected ? 'no active session' : 'e.g. Fort Irwin NTC'}
			disabled={disconnected}
		/>
	</div>
	<div class="field">
		<label for="mh-notes">Notes</label>
		<textarea
			id="mh-notes"
			bind:value={fields.notes}
			onblur={() => void persist()}
			maxlength="1024"
			rows="2"
			placeholder={disconnected ? 'no active session' : 'context for this session'}
			disabled={disconnected}
		></textarea>
	</div>

	{#if rfVisualization.activeSessionId}
		<div class="export-row">
			<span class="exp-key">export</span>
			<a
				class="exp-btn"
				href={`/api/sessions/${encodeURIComponent(rfVisualization.activeSessionId)}/export?format=csv`}
				download>CSV</a
			>
			<a
				class="exp-btn"
				href={`/api/sessions/${encodeURIComponent(rfVisualization.activeSessionId)}/export?format=kml`}
				download>KML</a
			>
		</div>
	{/if}
</div>

<style>
	.mission-header {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		padding: 0.5em 0.75em;
		font-family: 'Fira Code', ui-monospace, monospace;
	}
	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5em;
	}
	.mh-label {
		font-size: 0.68em;
		letter-spacing: 0.1em;
		color: var(--muted-foreground);
	}
	.mh-status {
		font-size: 0.68em;
		color: var(--muted-foreground);
	}
	.mh-err {
		color: var(--error-desat);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2em;
	}
	.field label {
		font-size: 0.68em;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}
	input,
	textarea {
		background: var(--card);
		color: var(--foreground);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0.3em 0.45em;
		font-size: 0.82em;
		font-family: inherit;
	}
	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--primary);
	}
	input:disabled,
	textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	textarea {
		resize: vertical;
		min-height: 2.5em;
	}
	.export-row {
		display: flex;
		align-items: center;
		gap: 0.5em;
		margin-top: 0.25em;
	}
	.exp-key {
		font-size: 0.62em;
		letter-spacing: 0.08em;
		color: var(--muted-foreground);
	}
	.exp-btn {
		font-family: inherit;
		font-size: 0.72em;
		color: var(--foreground);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0.15em 0.55em;
		text-decoration: none;
	}
	.exp-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
</style>
