<script lang="ts">
	import * as Table from '$lib/components/bits/table';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import type { SellerProduct } from '$lib/api/admin/products.remote';
	import ProductListRow from './product-list-row.svelte';

	let {
		/** The list of products to display. */
		products,
		/** All available bits (ingredients/components). */
		allBits,
		/** All available processing types. */
		allProcesses,
		/** All available allergen warnings. */
		allAllergenWarnings,
		/** Unit type options for the InputSelect. */
		unitTypes,
		/** Set of temporary IDs for products currently being created. */
		pendingIds,
		/** Map of temporary IDs to error messages for failed creates. */
		failedIds,
		/** Callback to save edits for a product. */
		onsave,
		/** Callback to delete a product. */
		ondelete,
		/** Callback to retry a failed create. */
		onretry,
		/** Callback to dismiss a failed create. */
		ondismiss,
		/** Callback to create a new bit. */
		onCreateBit
	}: {
		products: SellerProduct[];
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		unitTypes: InputSelectItem[];
		pendingIds: Set<string>;
		failedIds: Map<string, string>;
		onsave: (
			productId: string,
			edits: {
				name?: string;
				unitType?: string;
				facetValueIds?: string[];
			}
		) => Promise<void>;
		ondelete: (productId: string) => Promise<void>;
		onretry: (productId: string) => void;
		ondismiss: (productId: string) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	// ─── DOM-first cell navigation ───
	//
	// No JS focus state variable — document.activeElement IS the focus state.
	// Each cell has data-row + data-col attributes; interactive elements have data-focusable.
	// Navigation works via event delegation on the table wrapper's onkeydown.
	//
	// Key design contract with InputSelect:
	//   - InputSelect calls stopPropagation on ArrowUp/Down when its dropdown is open.
	//   - At dropdown boundaries (top/bottom), it closes the dropdown and lets the
	//     event bubble here, where we handle row-to-row navigation.
	//   - data-input-select marks InputSelect containers so we can distinguish them
	//     from regular text inputs (which don't need boundary logic).
	//
	// Auto-open (data-auto-open):
	//   focusCell() clicks (not focuses) elements with data-auto-open, opening the
	//   editor when arriving via keyboard. Hover just focuses — no auto-open.

	/** Reference to the table wrapper for DOM queries. */
	let tableEl: HTMLDivElement | null = $state(null);

	/**
	 * Ordered column names for keyboard navigation.
	 * Matches the visible product table columns from left to right.
	 */
	let colOrder = $derived(['name', 'unitType', 'bits', 'processes', 'allergens', 'actions']);

	/**
	 * Indices of selectable (non-pending, non-failed) product rows.
	 * Used to skip pending/failed rows during arrow key navigation.
	 */
	let selectableRowIndices = $derived(
		products
			.map((p, i) => ({ idx: i, selectable: !pendingIds.has(p.id) && !failedIds.has(p.id) }))
			.filter((r) => r.selectable)
			.map((r) => r.idx)
	);

	/** Find the next selectable row index in a given direction. */
	function nextSelectableRow(currentRow: number, direction: 1 | -1): number | null {
		const currentPos = selectableRowIndices.indexOf(currentRow);
		if (currentPos === -1) {
			return direction === 1
				? (selectableRowIndices.find((i) => i > currentRow) ?? null)
				: ([...selectableRowIndices].reverse().find((i) => i < currentRow) ?? null);
		}
		const nextPos = currentPos + direction;
		if (nextPos < 0 || nextPos >= selectableRowIndices.length) return null;
		return selectableRowIndices[nextPos];
	}

	/** Get the row/col of the currently focused element within the table. */
	function getCurrentCell(): { row: number; col: string } | null {
		const active = document.activeElement;
		if (!active || !tableEl?.contains(active)) return null;
		const cell = active.closest('[data-row][data-col]') as HTMLElement | null;
		if (!cell) return null;
		return {
			row: parseInt(cell.dataset.row!),
			col: cell.dataset.col!
		};
	}

	/**
	 * Focus the first [data-focusable] element in the given cell.
	 * If the element has data-auto-open, click it to open the editor instead.
	 */
	function focusCell(row: number, col: string) {
		const el = tableEl?.querySelector(
			`[data-row="${row}"][data-col="${col}"] [data-focusable]`
		) as HTMLElement | null;
		if (el) {
			if (el.hasAttribute('data-auto-open')) {
				el.scrollIntoView({ block: 'nearest' });
				el.click();
			} else {
				el.focus();
				el.scrollIntoView({ block: 'nearest' });
			}
		}
	}

	/**
	 * Focus the last [data-focusable] element in the given cell (for Shift+Tab into actions).
	 * If the element has data-auto-open, click it to open the editor instead.
	 */
	function focusCellLast(row: number, col: string) {
		const all = tableEl?.querySelectorAll(
			`[data-row="${row}"][data-col="${col}"] [data-focusable]`
		);
		const el = all?.[all.length - 1] as HTMLElement | null;
		if (el) {
			if (el.hasAttribute('data-auto-open')) {
				el.scrollIntoView({ block: 'nearest' });
				el.click();
			} else {
				el.focus();
				el.scrollIntoView({ block: 'nearest' });
			}
		}
	}

	/**
	 * Try to focus the next [data-focusable] sibling within the same cell.
	 * Returns true if a next sibling was found and focused, false otherwise.
	 */
	function focusNextInCell(direction: 1 | -1): boolean {
		const active = document.activeElement as HTMLElement | null;
		if (!active) return false;
		const cell = active.closest('[data-row][data-col]');
		if (!cell) return false;
		const focusables = Array.from(cell.querySelectorAll('[data-focusable]')) as HTMLElement[];
		const idx = focusables.indexOf(active);
		if (idx === -1) return false;
		const nextIdx = idx + direction;
		if (nextIdx >= 0 && nextIdx < focusables.length) {
			focusables[nextIdx].focus();
			return true;
		}
		return false;
	}

	/**
	 * Move focus to the next or previous column.
	 * Wraps to the next/prev selectable row at edges.
	 * For forward movement into a cell, focuses the first focusable.
	 * For backward movement, focuses the last (relevant for actions with multiple buttons).
	 */
	function moveToAdjacentCol(current: { row: number; col: string }, direction: 1 | -1) {
		const colIdx = colOrder.indexOf(current.col);
		const nextColIdx = colIdx + direction;

		if (nextColIdx >= 0 && nextColIdx < colOrder.length) {
			// Same row, different column
			if (direction === -1) {
				focusCellLast(current.row, colOrder[nextColIdx]);
			} else {
				focusCell(current.row, colOrder[nextColIdx]);
			}
		} else if (direction === 1) {
			// Past last column — wrap to first column of next row
			const nextRow = nextSelectableRow(current.row, 1);
			if (nextRow !== null) focusCell(nextRow, colOrder[0]);
		} else {
			// Before first column — wrap to last column of previous row
			const prevRow = nextSelectableRow(current.row, -1);
			if (prevRow !== null) focusCellLast(prevRow, colOrder[colOrder.length - 1]);
		}
	}

	/**
	 * Handle keyboard navigation at the table level via event delegation.
	 * Keydown events bubble from focused elements inside cells up to the table wrapper.
	 *
	 * InputSelect components call stopPropagation when handling Up/Down internally.
	 * When they let events bubble (at dropdown boundaries), we handle row navigation.
	 */
	function handleTableKeydown(e: KeyboardEvent) {
		const current = getCurrentCell();
		if (!current) return;

		/** Whether the focused element is a text input (not checkbox). */
		const isTextInput =
			(e.target as HTMLElement).tagName === 'INPUT' &&
			(e.target as HTMLInputElement).type !== 'checkbox';

		/** Whether the focused element is a checkbox. */
		const isCheckbox =
			(e.target as HTMLElement).tagName === 'INPUT' &&
			(e.target as HTMLInputElement).type === 'checkbox';

		switch (e.key) {
			case 'ArrowUp': {
				// InputSelect handles its own Up/Down when dropdown is open (via stopPropagation).
				// If the event reaches here, the dropdown is closed or at a boundary — navigate rows.
				e.preventDefault();
				const prevRow = nextSelectableRow(current.row, -1);
				if (prevRow !== null) focusCell(prevRow, current.col);
				break;
			}
			case 'ArrowDown': {
				e.preventDefault();
				const nextRow = nextSelectableRow(current.row, 1);
				if (nextRow !== null) focusCell(nextRow, current.col);
				break;
			}
			case 'Enter': {
				// Toggle checkbox on Enter (native behavior only triggers on Space)
				if (isCheckbox) {
					e.preventDefault();
					(e.target as HTMLInputElement).click();
				}
				break;
			}
			case 'ArrowLeft': {
				if (isTextInput) {
					const input = e.target as HTMLInputElement;
					// Only navigate if cursor is at the very start (no selection)
					if (input.selectionStart !== 0 || input.selectionEnd !== 0) return;
				}
				e.preventDefault();
				// In actions column, try to focus previous button in same cell first
				if (current.col === 'actions' && focusNextInCell(-1)) break;
				moveToAdjacentCol(current, -1);
				break;
			}
			case 'ArrowRight': {
				if (isTextInput) {
					const input = e.target as HTMLInputElement;
					const len = input.value.length;
					// Only navigate if cursor is at the very end (no selection)
					if (input.selectionStart !== len || input.selectionEnd !== len) return;
				}
				e.preventDefault();
				// In actions column, try to focus next button in same cell first
				if (current.col === 'actions' && focusNextInCell(1)) break;
				moveToAdjacentCol(current, 1);
				break;
			}
			case 'Tab': {
				e.preventDefault();
				const dir = e.shiftKey ? -1 : 1;
				// In actions column, try to cycle through buttons first
				if (current.col === 'actions' && focusNextInCell(dir)) break;
				moveToAdjacentCol(current, dir);
				break;
			}
		}
	}
</script>

{#if products.length === 0}
	<div class="flex items-center justify-center rounded-md border py-16">
		<p class="text-muted-foreground">No products yet. Add your first product above.</p>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="overflow-visible rounded-md border"
		data-testid="products-table"
		bind:this={tableEl}
		onkeydown={handleTableKeydown}
	>
		<Table.Table class="table-fixed">
			<Table.TableHeader>
				<Table.TableRow>
					<Table.TableHead class="text-center">Product</Table.TableHead>
					<Table.TableHead class="text-center">Unit</Table.TableHead>
					<Table.TableHead class="text-center">Ingredients</Table.TableHead>
					<Table.TableHead class="text-center">Processing</Table.TableHead>
					<Table.TableHead class="text-center">Allergens</Table.TableHead>
					<Table.TableHead class="text-center">Actions</Table.TableHead>
				</Table.TableRow>
			</Table.TableHeader>
			<Table.TableBody>
				{#each products as product, rowIndex (product.id)}
					<ProductListRow
						{product}
						{rowIndex}
						{allBits}
						{allProcesses}
						{allAllergenWarnings}
						{unitTypes}
						isPending={pendingIds.has(product.id)}
						isFailed={failedIds.has(product.id)}
						{onsave}
						{ondelete}
						{onretry}
						{ondismiss}
						{onCreateBit}
					/>
				{/each}
			</Table.TableBody>
		</Table.Table>
	</div>
{/if}
