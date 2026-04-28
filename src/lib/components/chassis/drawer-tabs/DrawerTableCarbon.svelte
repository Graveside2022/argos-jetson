<script lang="ts" generics="R">
	import { DataTable } from 'carbon-components-svelte';
	import { onMount, type Snippet } from 'svelte';

	// spec-026 Phase 2 — Carbon-themed DataTable wrapper. Same public API as
	// bespoke DrawerTable.svelte (Column<Row> kind discriminant + storageKey
	// persistence + cell snippet). Renders via Carbon's <DataTable size="compact">
	// for theme + a11y + spacing, with Lunaris look layered via cellHeader/cell
	// snippets and global CSS overrides on `.bx--data-table`.
	//
	// Reorder upgraded from HTML5 DnD to PointerEvents (per memory
	// project_spec024_wave1_spikes_done.md — 6.5× P95 win). Threshold-gated
	// click-vs-drag distinction lets sort + reorder share the same span.

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

	let { storageKey, columns, rows, rowKey, cell: userCell }: Props<R> = $props();

	type CarbonAugmentedRow = { id: string; [key: string]: unknown };

	let order = $state<string[]>([]);
	let sortById = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');

	let dragId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	let dragStartX = 0;
	let isDragging = $state(false);
	const DRAG_THRESHOLD_PX = 5;

	function applyStoredOrder(v: unknown): void {
		if (Array.isArray(v)) order = v as string[];
	}

	function applyStoredSortById(v: unknown): void {
		if (typeof v === 'string' || v === null) sortById = v as string | null;
	}

	function applyStoredSortDir(v: unknown): void {
		if (v === 'asc' || v === 'desc') sortDir = v;
	}

	function applyStored(p: { order?: unknown; sortById?: unknown; sortDir?: unknown }): void {
		applyStoredOrder(p.order);
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

	const orderedColumns = $derived.by(() => {
		const known = new Set(columns.map((c) => c.id));
		const kept = order.filter((id) => known.has(id));
		const added = columns.filter((c) => !kept.includes(c.id)).map((c) => c.id);
		return [...kept, ...added]
			.map((id) => columns.find((c) => c.id === id))
			.filter((c): c is Column<R> => c !== undefined);
	});

	function nullRank(v: unknown): number {
		return v === null ? 1 : 0;
	}

	function compareNonNull(va: string | number, vb: string | number): number {
		if (typeof va === 'number' && typeof vb === 'number') return va - vb;
		return String(va).localeCompare(String(vb));
	}

	function compareValues(va: string | number | null, vb: string | number | null): number {
		const ra = nullRank(va);
		const rb = nullRank(vb);
		if (ra !== rb) return ra - rb;
		if (ra === 1) return 0;
		return compareNonNull(va as string | number, vb as string | number);
	}

	const sortedRows = $derived.by(() => {
		if (sortById === null) return rows;
		const col = columns.find((c) => c.id === sortById);
		if (!col) return rows;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => compareValues(col.accessor(a), col.accessor(b)) * dir);
	});

	const carbonRows = $derived.by((): CarbonAugmentedRow[] =>
		sortedRows.map((r) => {
			const out: CarbonAugmentedRow = { id: rowKey(r) };
			for (const c of columns) out[c.id] = c.accessor(r);
			return out;
		})
	);

	const rowsById = $derived(new Map<string, R>(rows.map((r) => [rowKey(r), r])));

	const headers = $derived(
		orderedColumns.map((c) => ({
			key: c.id,
			value: c.label,
			sort: false as const
		}))
	);

	function getColumn(key: string): Column<R> | undefined {
		return columns.find((c) => c.id === key);
	}

	function onSortClick(colId: string): void {
		if (isDragging) {
			isDragging = false;
			return;
		}
		if (sortById === colId) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortById = colId;
		sortDir = 'asc';
	}

	function onPointerDown(e: PointerEvent, colId: string): void {
		dragId = colId;
		dragStartX = e.clientX;
		isDragging = false;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function pastDragThreshold(e: PointerEvent): boolean {
		return Math.abs(e.clientX - dragStartX) > DRAG_THRESHOLD_PX;
	}

	function onPointerMove(e: PointerEvent, colId: string): void {
		if (dragId === null) return;
		if (!isDragging && !pastDragThreshold(e)) return;
		isDragging = true;
		if (dragId !== colId) overId = colId;
	}

	function commitReorder(toId: string): void {
		if (dragId === null || dragId === toId) return;
		const next = [...order];
		const fromIdx = next.indexOf(dragId);
		const toIdx = next.indexOf(toId);
		if (fromIdx < 0 || toIdx < 0) return;
		next.splice(fromIdx, 1);
		next.splice(toIdx, 0, dragId);
		order = next;
	}

	function releasePointer(target: HTMLElement, pointerId: number): void {
		try {
			target.releasePointerCapture(pointerId);
		} catch {
			/* pointer already released by browser */
		}
	}

	function onPointerUp(e: PointerEvent, toId: string): void {
		if (dragId === null) return;
		if (isDragging) commitReorder(toId);
		dragId = null;
		overId = null;
		releasePointer(e.currentTarget as HTMLElement, e.pointerId);
		// isDragging intentionally NOT reset — the click event fires next and
		// reads it to suppress sort. onSortClick resets it on read; a fresh
		// onPointerDown also resets it.
	}

	function sortIndicator(colId: string): string {
		if (sortById !== colId) return '';
		return sortDir === 'asc' ? '↑' : '↓';
	}

	function onHeaderKeyDown(e: KeyboardEvent, colId: string): void {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		onSortClick(colId);
	}
</script>

<DataTable class="lunaris-drawer-table" size="compact" {headers} rows={carbonRows}>
	{#snippet cellHeader({ header })}
		{@const col = getColumn(header.key as string)}
		{#if col}
			<span
				class="dwt-th"
				data-kind={col.kind}
				class:dwt-th--drag={dragId === col.id}
				class:dwt-th--over={overId === col.id}
				class:dwt-th--active-sort={sortById === col.id}
				role="button"
				tabindex="0"
				onpointerdown={(e) => onPointerDown(e, col.id)}
				onpointermove={(e) => onPointerMove(e, col.id)}
				onpointerup={(e) => onPointerUp(e, col.id)}
				onclick={() => onSortClick(col.id)}
				onkeydown={(e) => onHeaderKeyDown(e, col.id)}
				title="Click to sort · drag to reorder"
			>
				<span class="dwt-label">{col.label}</span>
				<span class="dwt-sort-ind">{sortIndicator(col.id)}</span>
			</span>
		{/if}
	{/snippet}

	{#snippet cell({ cell: cellData, row })}
		{@const col = getColumn(cellData.key as string)}
		{@const original = rowsById.get(row.id as string)}
		{#if col}
			<span class="dwt-td" data-kind={col.kind}>
				{#if userCell && original}
					{@render userCell(original, col)}
				{:else}
					{cellData.value ?? ''}
				{/if}
			</span>
		{/if}
	{/snippet}
</DataTable>

<style>
	/* Lunaris overrides for Carbon's bx--data-table. We keep Carbon's chrome
	   (size, hover row, dividers, theme tokens) and inject UPPERCASE Geist Mono
	   headers + kind-aware alignment + dashed bottom borders for tactical look. */

	:global(.lunaris-drawer-table .bx--data-table) {
		font: 500 var(--mk2-fs-drawer-body) / 1.4 var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
		width: 100%;
	}

	:global(.lunaris-drawer-table .bx--data-table thead th) {
		background: var(--mk2-bg-2);
		color: var(--mk2-ink-4);
		border-bottom: 1px solid var(--mk2-line);
		padding: 0;
		position: sticky;
		top: 0;
		z-index: 1;
	}

	:global(.lunaris-drawer-table .bx--data-table tbody td) {
		padding: 0;
		border-bottom: 1px dashed var(--mk2-line);
		vertical-align: middle;
	}

	:global(.lunaris-drawer-table .bx--data-table tbody tr:hover td) {
		background: var(--mk2-bg-2);
	}

	:global(.lunaris-drawer-table .dwt-th) {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		font: 500 var(--mk2-fs-drawer-body) / 1 var(--mk2-f-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
		width: 100%;
		box-sizing: border-box;
		color: inherit;
		background: transparent;
		border: 0;
		touch-action: none;
	}

	:global(.lunaris-drawer-table .dwt-th:hover) {
		color: var(--mk2-ink-2);
	}

	:global(.lunaris-drawer-table .dwt-th--active-sort) {
		color: var(--mk2-ink);
	}

	:global(.lunaris-drawer-table .dwt-th--drag) {
		opacity: 0.4;
	}

	:global(.lunaris-drawer-table .dwt-th--over) {
		box-shadow: inset 2px 0 0 var(--mk2-accent);
	}

	:global(.lunaris-drawer-table .dwt-td) {
		display: flex;
		align-items: center;
		padding: 6px 12px;
		width: 100%;
		box-sizing: border-box;
	}

	/* Kind-aware alignment. Header inherits body alignment so the eye doesn't
	   see "swim" between left-aligned label sitting above right-aligned numbers. */
	:global(.lunaris-drawer-table .dwt-th[data-kind='num']),
	:global(.lunaris-drawer-table .dwt-th[data-kind='action']),
	:global(.lunaris-drawer-table .dwt-td[data-kind='num']),
	:global(.lunaris-drawer-table .dwt-td[data-kind='action']) {
		justify-content: flex-end;
		text-align: right;
	}

	:global(.lunaris-drawer-table .dwt-th[data-kind='id']),
	:global(.lunaris-drawer-table .dwt-td[data-kind='id']) {
		white-space: nowrap;
	}

	:global(.lunaris-drawer-table .dwt-th[data-kind='num']),
	:global(.lunaris-drawer-table .dwt-td[data-kind='num']),
	:global(.lunaris-drawer-table .dwt-th[data-kind='time']),
	:global(.lunaris-drawer-table .dwt-td[data-kind='time']),
	:global(.lunaris-drawer-table .dwt-th[data-kind='tag']),
	:global(.lunaris-drawer-table .dwt-td[data-kind='tag']) {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	:global(.lunaris-drawer-table .dwt-th[data-kind='id']) {
		min-width: 18ch;
	}
	:global(.lunaris-drawer-table .dwt-th[data-kind='num']) {
		min-width: 6ch;
	}
	:global(.lunaris-drawer-table .dwt-th[data-kind='time']) {
		min-width: 9ch;
	}
	:global(.lunaris-drawer-table .dwt-th[data-kind='tag']) {
		min-width: 8ch;
	}
	:global(.lunaris-drawer-table .dwt-th[data-kind='text']) {
		min-width: 12ch;
	}
	:global(.lunaris-drawer-table .dwt-th[data-kind='action']),
	:global(.lunaris-drawer-table .dwt-td[data-kind='action']) {
		min-width: 32px;
	}

	:global(.lunaris-drawer-table .dwt-sort-ind) {
		display: inline-block;
		min-width: 10px;
		color: var(--mk2-accent);
		font-weight: 600;
	}
</style>
