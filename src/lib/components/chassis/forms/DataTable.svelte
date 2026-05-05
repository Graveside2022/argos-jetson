<script lang="ts" module>
	export interface DataTableHeader {
		key: string;
		value: string;
		empty?: boolean;
		sort?: ((a: unknown, b: unknown) => number) | false;
	}

	export interface DataTableRow {
		id: string;
		[key: string]: unknown;
	}
</script>

<script lang="ts">
	import { DataTable as CarbonDataTable } from 'carbon-components-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		headers: DataTableHeader[];
		rows: DataTableRow[];
		title?: string;
		description?: string;
		size?: 'compact' | 'short' | 'medium' | 'tall';
		sortable?: boolean;
		zebra?: boolean;
		stickyHeader?: boolean;
		batchSelection?: boolean;
		selectedRowIds?: string[];
		expandable?: boolean;
		radio?: boolean;
		nonExpandableRowIds?: string[];
		class?: string;
		onClickRow?: (row: DataTableRow) => void;
		onSelectRow?: (selected: string[]) => void;
		cell?: Snippet<[{ row: DataTableRow; cell: { key: string; value: unknown } }]>;
	}

	let {
		headers,
		rows,
		title,
		description,
		size = 'medium',
		sortable = false,
		zebra = false,
		stickyHeader = false,
		batchSelection = false,
		selectedRowIds = $bindable([]),
		expandable = false,
		radio = false,
		nonExpandableRowIds,
		class: extraClass = '',
		onClickRow,
		onSelectRow,
		cell
	}: Props = $props();

	function handleClickRow(e: CustomEvent<{ row: DataTableRow }>): void {
		onClickRow?.(e.detail.row);
	}

	$effect(() => {
		onSelectRow?.(selectedRowIds);
	});
</script>

<CarbonDataTable
	{headers}
	{rows}
	{title}
	{description}
	{size}
	{sortable}
	{zebra}
	{stickyHeader}
	{batchSelection}
	bind:selectedRowIds
	{expandable}
	{radio}
	{nonExpandableRowIds}
	class={extraClass}
	on:click:row={handleClickRow}
>
	<svelte:fragment slot="cell" let:row let:cell={cellInfo}>
		{#if cell}
			{@render cell({ row, cell: cellInfo })}
		{:else}
			{cellInfo.value ?? ''}
		{/if}
	</svelte:fragment>
</CarbonDataTable>
