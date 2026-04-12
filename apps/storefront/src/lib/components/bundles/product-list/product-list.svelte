<script lang="ts">
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import type { SellerProduct } from '$lib/api/admin/products.remote';
	import { Button } from '$lib/components/bits/button';
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
		pendingIds: Set<string>;
		failedIds: Map<string, string>;
		onsave: (
			productId: string,
			edits: {
				name?: string;
				facetValueIds?: string[];
			}
		) => Promise<void>;
		ondelete: (productId: string) => Promise<void>;
		onretry: (productId: string) => void;
		ondismiss: (productId: string) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	// ─── Bulk expand/collapse toggles ───

	/** Global default for whether metadata tiers are expanded across all rows. */
	let globalMetadata = $state(false);

	// ─── DOM-first cell navigation ───
	//
	// No JS focus state variable — document.activeElement IS the focus state.
	// Each cell has data-row + data-col attributes; interactive elements have data-focusable.
	// Navigation works via event delegation on the list wrapper's onkeydown.
	//
	// Arrow keys navigate tier-1 columns only (name, unitType, actions).
	// Tab/Shift-Tab walks the full sequence including expanded tier-2 fields.
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

	/** Reference to the list wrapper for DOM queries. */
	let listEl: HTMLDivElement | null = $state(null);

	/**
	 * Tier-1 column order for arrow key navigation.
	 * Arrow keys only move between these three columns.
	 */
	let colOrder = $derived(['name', 'actions']);

	/**
	 * Full column order for Tab navigation.
	 * Tab walks tier-1 then tier-2 (if expanded), skipping collapsed cells.
	 */
	const tabOrder = ['name', 'actions', 'bits', 'processes', 'allergens'];

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

	/** Get the row/col of the currently focused element within the list. */
	function getCurrentCell(): { row: number; col: string } | null {
		const active = document.activeElement;
		if (!active || !listEl?.contains(active)) return null;
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
	 * Returns true if a focusable element was found.
	 */
	function focusCell(row: number, col: string): boolean {
		const el = listEl?.querySelector(
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
			return true;
		}
		return false;
	}

	/**
	 * Focus the last [data-focusable] element in the given cell (for Shift+Tab into actions).
	 * If the element has data-auto-open, click it to open the editor instead.
	 * Returns true if a focusable element was found.
	 */
	function focusCellLast(row: number, col: string): boolean {
		const all = listEl?.querySelectorAll(
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
			return true;
		}
		return false;
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
	 * Move focus to the next or previous column using arrow keys (tier-1 only).
	 * Wraps to the next/prev selectable row at edges.
	 */
	function moveToAdjacentCol(current: { row: number; col: string }, direction: 1 | -1) {
		const colIdx = colOrder.indexOf(current.col);
		if (colIdx === -1) return; // Current col not in tier-1 colOrder (e.g. in expanded metadata)

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
	 * Move focus to the next or previous cell using Tab (full order including tier-2).
	 * Skips cells that don't exist in DOM (collapsed tier-2).
	 */
	function moveToAdjacentTabCell(current: { row: number; col: string }, direction: 1 | -1) {
		const tabIdx = tabOrder.indexOf(current.col);
		if (tabIdx === -1) return;

		// Try remaining columns in this row
		let nextIdx = tabIdx + direction;
		while (nextIdx >= 0 && nextIdx < tabOrder.length) {
			const col = tabOrder[nextIdx];
			const found =
				direction === -1
					? focusCellLast(current.row, col)
					: focusCell(current.row, col);
			if (found) return;
			// Cell not in DOM (collapsed tier) — skip to next
			nextIdx += direction;
		}

		// Exhausted this row — wrap to next/prev row
		if (direction === 1) {
			const nextRow = nextSelectableRow(current.row, 1);
			if (nextRow !== null) focusCell(nextRow, tabOrder[0]);
		} else {
			const prevRow = nextSelectableRow(current.row, -1);
			if (prevRow !== null) {
				// Try from the end of tabOrder backwards to find last existing cell
				for (let i = tabOrder.length - 1; i >= 0; i--) {
					if (focusCellLast(prevRow, tabOrder[i])) return;
				}
			}
		}
	}

	/**
	 * Handle keyboard navigation at the list level via event delegation.
	 * Keydown events bubble from focused elements inside cells up to the list wrapper.
	 *
	 * Arrow keys navigate tier-1 only (name, unitType, actions).
	 * Tab walks the full sequence including expanded tier-2 fields.
	 *
	 * InputSelect components call stopPropagation when handling Up/Down internally.
	 * When they let events bubble (at dropdown boundaries), we handle row navigation.
	 */
	function handleListKeydown(e: KeyboardEvent) {
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
				// Arrow keys only navigate tier-1 rows
				e.preventDefault();
				const prevRow = nextSelectableRow(current.row, -1);
				if (prevRow !== null) {
					// If currently in a tier-2 cell, jump to tier-1 'name' of prev row
					const targetCol = colOrder.includes(current.col) ? current.col : 'name';
					focusCell(prevRow, targetCol);
				}
				break;
			}
			case 'ArrowDown': {
				e.preventDefault();
				const nextRow = nextSelectableRow(current.row, 1);
				if (nextRow !== null) {
					const targetCol = colOrder.includes(current.col) ? current.col : 'name';
					focusCell(nextRow, targetCol);
				}
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
				moveToAdjacentTabCell(current, dir);
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
	<!-- Bulk toggles -->
	<div class="mb-2 flex items-center gap-2">
		<Button
			size="sm"
			variant="ghost"
			class="h-7 gap-1 px-2 text-xs text-muted-foreground"
			onclick={() => (globalMetadata = !globalMetadata)}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="transition-transform {globalMetadata ? 'rotate-90' : ''}"
			>
				<polyline points="9 18 15 12 9 6" />
			</svg>
			Metadata
		</Button>
	</div>

	<!-- Product list -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="overflow-visible rounded-md border"
		data-testid="products-table"
		bind:this={listEl}
		onkeydown={handleListKeydown}
	>
		{#each products as product, rowIndex (product.id)}
			<ProductListRow
				{product}
				{rowIndex}
				{allBits}
				{allProcesses}
				{allAllergenWarnings}
				isPending={pendingIds.has(product.id)}
				isFailed={failedIds.has(product.id)}
				globalMetadataDefault={globalMetadata}
				{onsave}
				{ondelete}
				{onretry}
				{ondismiss}
				{onCreateBit}
			/>
		{/each}
	</div>
{/if}
