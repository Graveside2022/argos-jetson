<script lang="ts">
	// spec-024 PR5b T030 — Mk II MissionStrip.
	//
	// Five-cell engagement strip: ENGAGEMENT (mission name) / OPERATOR /
	// TARGET / TIMER / LINK BUDGET. Click a cell → swap to <input> →
	// commit (PATCH /api/missions/:id) on blur or Enter. Esc restores
	// the prior value. Empty + Error + Loading + Default states all
	// rendered (Lunaris design rule). Multi-mission switcher uses a
	// native <select> for accessibility; a "+ NEW" button creates a
	// fresh mission and promotes it to active.
	import { onMount } from 'svelte';

	import IconBtn from '$lib/components/mk2/IconBtn.svelte';
	import { missionStore } from '$lib/state/missions.svelte';
	import type { Mission, MissionPatch } from '$lib/types/mission';

	const TICK_MS = 1000;

	let nowMs = $state<number>(Date.now());
	let editingField = $state<keyof MissionPatch | null>(null);
	let editValue = $state<string>('');

	onMount(() => {
		void missionStore.load();
		const handle = window.setInterval(() => {
			nowMs = Date.now();
		}, TICK_MS);
		return () => window.clearInterval(handle);
	});

	const active = $derived<Mission | null>(missionStore.active);
	const all = $derived<Mission[]>(missionStore.missions);
	const elapsed = $derived(active ? Math.max(0, nowMs - active.created_at) : 0);

	function fmtTimer(ms: number): string {
		const total = Math.floor(ms / 1000);
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${pad(h)}:${pad(m)}:${pad(s)}`;
	}

	function fmtLinkBudget(v: number | null): string {
		return v == null ? '—' : `${v.toFixed(1)} dB`;
	}

	function toEditString(field: keyof MissionPatch, m: Mission): string {
		const v = m[field];
		if (v == null) return '';
		return String(v);
	}

	function parseLinkBudget(trimmed: string): number | null | undefined {
		if (trimmed === '') return null;
		const n = Number(trimmed);
		return Number.isFinite(n) ? n : undefined;
	}

	function parseEditValue(field: keyof MissionPatch, raw: string): MissionPatch[keyof MissionPatch] {
		const trimmed = raw.trim();
		if (field === 'link_budget') return parseLinkBudget(trimmed);
		// name disallows empty per server schema; surface as undefined → no-op
		if (field === 'name' && trimmed === '') return undefined;
		return trimmed === '' ? null : trimmed;
	}

	function startEdit(field: keyof MissionPatch): void {
		if (!active) return;
		editingField = field;
		editValue = toEditString(field, active);
	}

	function cancelEdit(): void {
		editingField = null;
		editValue = '';
	}

	async function commitEdit(): Promise<void> {
		if (!active || !editingField) return;
		const field = editingField;
		const next = parseEditValue(field, editValue);
		editingField = null;
		if (next === undefined) return;
		const current = active[field];
		if (next === current) return;
		await missionStore.patch(active.id, { [field]: next } as MissionPatch);
	}

	function onKey(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			void commitEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	function onSwitcherChange(e: Event): void {
		const id = (e.target as HTMLSelectElement).value;
		if (id && id !== active?.id) void missionStore.setActive(id);
	}

	async function onNewMission(): Promise<void> {
		const name = window.prompt('mission name?', 'Op Untitled');
		if (!name || !name.trim()) return;
		await missionStore.create({ name: name.trim(), type: 'sitrep-loop', set_active: true });
	}
</script>

<div class="mission-strip" data-state={active ? 'default' : all.length === 0 ? 'empty' : 'inactive'}>
	<div class="strip-header">
		{#if all.length === 0}
			<span class="empty-label">NO MISSIONS — </span>
			<button class="new-btn" type="button" onclick={onNewMission}>+ CREATE FIRST</button>
		{:else}
			<select
				class="switcher"
				value={active?.id ?? ''}
				onchange={onSwitcherChange}
				aria-label="active mission"
			>
				{#if !active}
					<option value="">— select active —</option>
				{/if}
				{#each all as m (m.id)}
					<option value={m.id}>{m.name}</option>
				{/each}
			</select>
			<IconBtn onclick={onNewMission} aria-label="new mission">+</IconBtn>
		{/if}
		{#if missionStore.lastError}
			<span class="err" role="alert">ERR: {missionStore.lastError}</span>
		{/if}
	</div>

	<div class="strip-cells">
		{#each [
			{ field: 'name' as const, label: 'ENGAGEMENT', readonly: false },
			{ field: 'operator' as const, label: 'OPERATOR', readonly: false },
			{ field: 'target' as const, label: 'TARGET', readonly: false },
			{ field: null, label: 'TIMER', readonly: true },
			{ field: 'link_budget' as const, label: 'LINK BUDGET', readonly: false }
		] as cell (cell.label)}
			<div class="cell">
				<div class="cell-label">{cell.label}</div>
				{#if !active}
					<div class="cell-value placeholder">—</div>
				{:else if cell.readonly}
					<div class="cell-value mono">{fmtTimer(elapsed)}</div>
				{:else if editingField === cell.field}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="cell-input mono"
						bind:value={editValue}
						onblur={() => void commitEdit()}
						onkeydown={onKey}
						type={cell.field === 'link_budget' ? 'number' : 'text'}
						step={cell.field === 'link_budget' ? '0.1' : undefined}
						autofocus
					/>
				{:else if cell.field === 'link_budget'}
					<button
						class="cell-value mono editable"
						type="button"
						onclick={() => cell.field && startEdit(cell.field)}
					>{fmtLinkBudget(active.link_budget)}</button>
				{:else}
					<button
						class="cell-value mono editable"
						type="button"
						onclick={() => cell.field && startEdit(cell.field)}
					>{active[cell.field] ?? '—'}</button>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.mission-strip {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		font-family: 'Fira Code', monospace;
	}
	.strip-header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}
	.switcher {
		background: transparent;
		color: inherit;
		border: 1px solid var(--border);
		padding: 2px 6px;
		font-family: inherit;
		font-size: 11px;
		min-width: 200px;
	}
	.switcher:focus {
		outline: 1px solid var(--primary);
	}
	.empty-label {
		color: var(--muted-foreground);
	}
	.new-btn {
		background: transparent;
		color: var(--primary);
		border: 1px solid var(--primary);
		padding: 2px 8px;
		font: inherit;
		cursor: pointer;
	}
	.err {
		color: var(--destructive, #c45b4a);
		margin-left: auto;
		font-size: 10px;
	}
	.strip-cells {
		display: grid;
		grid-template-columns: 2fr 1fr 1.5fr 1fr 1fr;
		gap: 16px;
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.cell-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: var(--muted-foreground);
	}
	.cell-value {
		font-size: 12px;
		text-align: left;
		background: transparent;
		border: 1px solid transparent;
		padding: 2px 4px;
		color: inherit;
		font-family: inherit;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cell-value.mono {
		font-family: 'Fira Code', monospace;
	}
	.cell-value.placeholder {
		color: var(--muted-foreground);
	}
	.cell-value.editable {
		cursor: text;
	}
	.cell-value.editable:hover {
		border-color: var(--border);
	}
	.cell-input {
		font-size: 12px;
		background: var(--background);
		color: inherit;
		border: 1px solid var(--primary);
		padding: 2px 4px;
		width: 100%;
	}
	.cell-input:focus {
		outline: none;
	}
</style>
