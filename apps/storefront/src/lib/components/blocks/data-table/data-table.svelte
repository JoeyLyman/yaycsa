<script lang="ts" generics="TData">
	import {
		createTable,
		getCoreRowModel,
		getSortedRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		type ColumnDef,
		type SortingState,
		type TableOptions,
		type Table,
		flexRender,
	} from '@tanstack/table-core';
	import * as TablePrimitives from '$lib/components/bits/table';
	import { cn } from '$lib/components/utils.js';

	interface Props {
		/** Column definitions for the table. */
		columns: ColumnDef<TData, any>[];
		/** Data array to render. */
		data: TData[];
		/** Optional CSS class for the wrapper. */
		class?: string;
		/** Whether to show pagination controls. Default: false (show all rows). */
		paginate?: boolean;
		/** Rows per page when pagination is enabled. Default: 20. */
		pageSize?: number;
		/** Optional snippet to render above the table (e.g., add-row form). */
		header?: import('svelte').Snippet;
		/** Optional snippet for empty state. */
		empty?: import('svelte').Snippet;
	}

	let {
		columns,
		data,
		class: className,
		paginate = false,
		pageSize = 20,
		header,
		empty,
	}: Props = $props();

	/** Current sorting state. */
	let sorting: SortingState = $state([]);

	/** Global filter value. */
	let globalFilter: string = $state('');

	/**
	 * Create a reactive TanStack Table instance.
	 * Re-derives whenever data, columns, sorting, or filter changes.
	 */
	let table: Table<TData> = $derived.by(() => {
		const options: TableOptions<TData> = {
			data,
			columns,
			state: {
				sorting,
				globalFilter,
			},
			onSortingChange: (updater) => {
				sorting = typeof updater === 'function' ? updater(sorting) : updater;
			},
			onGlobalFilterChange: (updater) => {
				globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
			},
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}),
		};

		const t = createTable(options);

		if (paginate) {
			t.setPageSize(pageSize);
		}

		return t;
	});
</script>

<div class={cn('w-full', className)}>
	{#if header}
		{@render header()}
	{/if}

	<div class="overflow-x-auto rounded-md border">
		<TablePrimitives.Table>
			<TablePrimitives.TableHeader>
				{#each table.getHeaderGroups() as headerGroup}
					<TablePrimitives.TableRow>
						{#each headerGroup.headers as headerCell}
							<TablePrimitives.TableHead
								class={cn(
									headerCell.column.getCanSort() && 'cursor-pointer select-none',
								)}
								onclick={headerCell.column.getToggleSortingHandler()}
							>
								{#if !headerCell.isPlaceholder}
									{@const rendered = flexRender(headerCell.column.columnDef.header, headerCell.getContext())}
									{#if typeof rendered === 'string'}
										{rendered}
									{:else if rendered?.toString}
										{rendered.toString()}
									{/if}
									<!-- Sort indicator -->
									{#if headerCell.column.getIsSorted() === 'asc'}
										<span class="ml-1">↑</span>
									{:else if headerCell.column.getIsSorted() === 'desc'}
										<span class="ml-1">↓</span>
									{/if}
								{/if}
							</TablePrimitives.TableHead>
						{/each}
					</TablePrimitives.TableRow>
				{/each}
			</TablePrimitives.TableHeader>

			<TablePrimitives.TableBody>
				{#if table.getRowModel().rows.length === 0}
					<TablePrimitives.TableRow>
						<TablePrimitives.TableCell
							colspan={columns.length}
							class="h-24 text-center text-muted-foreground"
						>
							{#if empty}
								{@render empty()}
							{:else}
								No results.
							{/if}
						</TablePrimitives.TableCell>
					</TablePrimitives.TableRow>
				{:else}
					{#each table.getRowModel().rows as row}
						<TablePrimitives.TableRow>
							{#each row.getVisibleCells() as cell}
								<TablePrimitives.TableCell>
									{@const rendered = flexRender(cell.column.columnDef.cell, cell.getContext())}
									{#if typeof rendered === 'string'}
										{rendered}
									{:else if rendered?.toString}
										{rendered.toString()}
									{/if}
								</TablePrimitives.TableCell>
							{/each}
						</TablePrimitives.TableRow>
					{/each}
				{/if}
			</TablePrimitives.TableBody>
		</TablePrimitives.Table>
	</div>

	{#if paginate && table.getPageCount() > 1}
		<div class="flex items-center justify-between px-2 py-4">
			<span class="text-sm text-muted-foreground">
				Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
			</span>
			<div class="flex gap-2">
				<button
					class="rounded border px-3 py-1 text-sm disabled:opacity-50"
					disabled={!table.getCanPreviousPage()}
					onclick={() => table.previousPage()}
				>
					Previous
				</button>
				<button
					class="rounded border px-3 py-1 text-sm disabled:opacity-50"
					disabled={!table.getCanNextPage()}
					onclick={() => table.nextPage()}
				>
					Next
				</button>
			</div>
		</div>
	{/if}
</div>
