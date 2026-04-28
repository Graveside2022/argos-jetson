<script lang="ts" generics="R">
	import { onMount, type Snippet } from 'svelte';

	// spec-024 Phase 3 — shared reorderable + sortable table primitive for the
	// 5 drawer-tab screens (Logs / Captures / Wifi / Bluetooth / Uas). Drag a
	// column header left/right to reorder; click to cycle sort asc → desc → asc.
	// Both states persist to localStorage per `storageKey`.

	// spec-024 Phase 3 — column-kind taxonomy. One discriminant drives
	// alignment, min-width, whitespace, and font for both <th> and <td>.
	// Header inherits body alignment so the eye doesn't see "swim" between
	// a left-aligned label sitting above right-aligned numbers.
	//   id     identifiers (MAC, filename, drone serial). mono, nowrap, left.
	//   text   freeform prose (SSID, message, name). flex-grow, left, wrap.
	//   num    measures (RSSI, channel, size, packets). tabular-nums, right.
	//   time   timestamps (Z-suffixed). tabular-nums, nowrap, left.
	//   tag    short categorical badges (LEVEL, ENC, TOOL, TYPE). nowrap, left.
	//   action icon-only cells (download). narrow fixed width, right.
	export type ColumnKind = 'id' | 'text' | 'num' | 'time' | 'tag' | 'action';

	export interface Column<Row> {
		id: string;
		label: string;
		accessor: (row: Row) => string | number | null;
		kind: ColumnKind;
	}

	interface Props<Row> {
		storageKey: string;
		columns: readonly Column<Row>[];
		rows: readonly Row[];
		rowKey: (row: Row) => string;
		cell?: Snippet<[Row, Column<Row>]>;
	}

	let { storageKey, columns, rows, rowKey, cell }: Props<R> = $props();

	// `order` is user drag-state; we don't want it reactive to prop changes.
	// Empty-init avoids `state_referenced_locally` warning; populate in onMount.
	let order = $state<string[]>([]);
	let sortById = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');
	let dragId = $state<string | null>(null);
	let overId = $state<string | null>(null);

	function applyStoredSortById(v: unknown): void {
		if (typeof v === 'string' || v === null) sortById = v as string | null;
	}

	function applyStoredSortDir(v: unknown): void {
		if (v === 'asc' || v === 'desc') sortDir = v;
	}

	function applyStored(p: { order?: unknown; sortById?: unknown; sortDir?: unknown }): void {
		if (Array.isArray(p.order)) order = p.order as string[];
		applyStoredSortById(p.sortById);
		applyStoredSortDir(p.sortDir);
	}

	function loadStored(): void {
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return;
			applyStored(JSON.parse(raw));
		} catch {
			/* corrupt JSON / disabled — keep defaults */
		}
	}

	let mounted = $state(false);

	onMount(() => {
		order = columns.map((c) => c.id);
		loadStored();
		mounted = true;
	});

	$effect(() => {
		if (!mounted) return;
		try {
			localStorage.setItem(storageKey, JSON.stringify({ order, sortById, sortDir }));
		} catch {
			/* quota / disabled — ignore */
		}
	});

	// Reconcile in a $derived (read-only) instead of a $effect (which would
	// mutate `order` and re-trigger itself → effect_update_depth_exceeded).
	// Stale ids drop out, new column ids append, all without touching state.
	const orderedColumns = $derived.by(() => {
		const known = new Set(columns.map((c) => c.id));
		const kept = order.filter((id) => known.has(id));
		const added = columns.filter((c) => !kept.includes(c.id)).map((c) => c.id);
		const reconciled = [...kept, ...added];
		return reconciled
			.map((id) => columns.find((c) => c.id === id))
			.filter((c): c is Column<R> => c !== undefined);
	});

	function nullRank(v: unknown): number {
		return v === null ? 1 : 0;
	}

	function nonNullCompare(va: string | number, vb: string | number): number {
		if (typeof va === 'number' && typeof vb === 'number') return va - vb;
		return String(va).localeCompare(String(vb));
	}

	function compareValues(va: string | number | null, vb: string | number | null): number {
		const ra = nullRank(va);
		const rb = nullRank(vb);
		if (ra !== rb) return ra - rb;
		if (ra === 1) return 0;
		return nonNullCompare(va as string | number, vb as string | number);
	}

	const sortedRows = $derived.by(() => {
		if (sortById === null) return rows;
		const col = columns.find((c) => c.id === sortById);
		if (!col) return rows;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => compareValues(col.accessor(a), col.accessor(b)) * dir);
	});

	function onSortClick(colId: string): void {
		if (sortById === colId) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortById = colId;
		sortDir = 'asc';
	}

	function onDragStart(e: DragEvent, colId: string): void {
		dragId = colId;
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDragOver(e: DragEvent, colId: string): void {
		e.preventDefault();
		if (dragId !== null && dragId !== colId) overId = colId;
	}

	function onDragLeave(colId: string): void {
		if (overId === colId) overId = null;
	}

	function onDrop(e: DragEvent, toId: string): void {
		e.preventDefault();
		if (dragId === null || dragId === toId) return;
		const next = [...order];
		const fromIdx = next.indexOf(dragId);
		const toIdx = next.indexOf(toId);
		if (fromIdx < 0 || toIdx < 0) return;
		next.splice(fromIdx, 1);
		next.splice(toIdx, 0, dragId);
		order = next;
		dragId = null;
		overId = null;
	}

	function onDragEnd(): void {
		dragId = null;
		overId = null;
	}

	function sortIndicator(colId: string): string {
		if (sortById !== colId) return '';
		return sortDir === 'asc' ? '↑' : '↓';
	}
</script>

<table class="tbl">
	<thead>
		<tr>
			{#each orderedColumns as col (col.id)}
				<th
					data-kind={col.kind}
					class:drag={dragId === col.id}
					class:over={overId === col.id}
					class:active-sort={sortById === col.id}
					draggable="true"
					ondragstart={(e) => onDragStart(e, col.id)}
					ondragover={(e) => onDragOver(e, col.id)}
					ondragleave={() => onDragLeave(col.id)}
					ondrop={(e) => onDrop(e, col.id)}
					ondragend={onDragEnd}
					onclick={() => onSortClick(col.id)}
					title="Click to sort · drag to reorder"
				>
					<span class="label">{col.label}</span>
					<span class="sort-ind">{sortIndicator(col.id)}</span>
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each sortedRows as r (rowKey(r))}
			<tr>
				{#each orderedColumns as col (col.id)}
					<td data-kind={col.kind}>
						{#if cell}
							{@render cell(r, col)}
						{:else}
							{col.accessor(r) ?? ''}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.tbl {
		width: 100%;
		border-collapse: collapse;
		font: 500 var(--mk2-fs-drawer-body) / 1.4 var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.tbl th {
		text-align: left;
		padding: 6px 12px;
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-drawer-body);
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: var(--mk2-bg-2);
		border-bottom: 1px solid var(--mk2-line);
		position: sticky;
		top: 0;
		z-index: 1;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
	}

	/* Column-type alignment convention — drives th + td from one [data-kind]
	   attribute. Three alignment groups (per AG Grid + Material Data Tables):
	     - num + action  → right (decimal scanning, icon edge)
	     - time + tag    → center (≤8 chars, optical balance, no scanning need)
	     - id + text     → left (word-stem alignment for identifiers and prose)
	   Header alignment inherits body alignment so the eye doesn't see "swim". */
	.tbl th[data-kind='num'],
	.tbl td[data-kind='num'],
	.tbl th[data-kind='action'],
	.tbl td[data-kind='action'] {
		text-align: right;
	}

	.tbl th[data-kind='time'],
	.tbl td[data-kind='time'],
	.tbl th[data-kind='tag'],
	.tbl td[data-kind='tag'] {
		text-align: center;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.tbl th[data-kind='id'],
	.tbl td[data-kind='id'] {
		white-space: nowrap;
	}

	.tbl th[data-kind='num'],
	.tbl td[data-kind='num'] {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	/* Shrink non-text columns to their content + min-width. The `text` kind has
	   no width rule, so browser table-layout gives it all leftover horizontal
	   space — eliminates the 60-90% dead-space the original design suffered.
	   When a tab has no `text` kind (Captures), the longest column absorbs. */
	.tbl th[data-kind='id'],
	.tbl th[data-kind='num'],
	.tbl th[data-kind='time'],
	.tbl th[data-kind='tag'],
	.tbl th[data-kind='action'] {
		width: 1px;
	}

	/* Min-widths in ch units — monospace 1ch ≈ glyph advance, so widths
	   survive theme / zoom changes that pixel widths don't. Action cells
	   carry a 12px lucide icon + 8px breathing room. */
	.tbl th[data-kind='id'] {
		min-width: 18ch;
	}
	.tbl th[data-kind='num'] {
		min-width: 6ch;
	}
	.tbl th[data-kind='time'] {
		min-width: 9ch;
	}
	.tbl th[data-kind='tag'] {
		min-width: 8ch;
	}
	.tbl th[data-kind='text'] {
		min-width: 12ch;
	}
	.tbl th[data-kind='action'],
	.tbl td[data-kind='action'] {
		width: 32px;
		min-width: 32px;
	}

	.tbl th:hover {
		color: var(--mk2-ink-2);
	}

	.tbl th.active-sort {
		color: var(--mk2-ink);
	}

	.tbl th.drag {
		opacity: 0.4;
	}

	.tbl th.over {
		box-shadow: inset 2px 0 0 var(--mk2-accent);
	}

	.tbl th .sort-ind {
		display: inline-block;
		min-width: 10px;
		margin-left: 4px;
		color: var(--mk2-accent);
		font-weight: 600;
	}

	.tbl td {
		padding: 6px 12px;
		border-bottom: 1px dashed var(--mk2-line);
		vertical-align: middle;
	}

	.tbl tr:hover td {
		background: var(--mk2-bg-2);
	}
</style>
