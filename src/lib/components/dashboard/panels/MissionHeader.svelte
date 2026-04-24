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

	let fields = $state<MissionFields>({ operatorId: '', assetId: '', areaName: '', notes: '' });
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let loadedSessionId = $state<string | null>(null);

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
		fields = {
			operatorId: data.operatorId ?? '',
			assetId: data.assetId ?? '',
			areaName: data.areaName ?? '',
			notes: data.notes ?? ''
		};
		loadedSessionId = id;
	}

	async function loadMetadata(id: string): Promise<void> {
		saveError = null;
		try {
			applyMissionResponse(id, await fetchMission(id));
		} catch (err) {
			saveError = err instanceof Error ? err.message : String(err);
		}
	}

	$effect(() => {
		const id = rfVisualization.activeSessionId;
		if (!id) return;
		if (loadedSessionId === id) return;
		void loadMetadata(id);
	});

	function buildPatchBody(): Record<string, string | null> {
		return {
			operatorId: fields.operatorId || null,
			assetId: fields.assetId || null,
			areaName: fields.areaName || null,
			notes: fields.notes || null
		};
	}

	async function patchMission(id: string): Promise<void> {
		const resp = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(buildPatchBody())
		});
		if (!resp.ok) throw new Error(`PATCH /api/sessions/${id} ${resp.status}`);
	}

	async function persist(): Promise<void> {
		const id = rfVisualization.activeSessionId;
		if (!id) return;
		saving = true;
		saveError = null;
		try {
			await patchMission(id);
		} catch (err) {
			saveError = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<div class="mission-header">
	<div class="label-row">
		<label class="mh-label" for="mh-operator">MISSION METADATA</label>
		{#if saving}
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
			placeholder="call-sign"
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
			placeholder="e.g. TRK-04"
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
			placeholder="e.g. Fort Irwin NTC"
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
			placeholder="context for this session"
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
		color: #c45b4a;
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
