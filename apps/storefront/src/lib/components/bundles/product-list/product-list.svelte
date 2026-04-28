<script lang="ts">
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import type { SellerProduct } from '$lib/api/admin/products.remote';
	import type { ProductDraft, ProductDraftPatch } from './product-list-types';
	import type { TableDetailMode } from '$lib/components/blocks/table-detail-toggle';
	import ProductListRowDraft from './product-list-row-draft.svelte';
	import ProductListRow from './product-list-row.svelte';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';

	let {
		/** The saved products currently shown in the seller table. */
		products,
		/** The unsaved inline draft rows currently shown below saved products. */
		productDrafts,
		/** All available bits (ingredients/components). */
		allBits,
		/** All available processing types. */
		allProcesses,
		/** All available allergen warnings. */
		allAllergenWarnings,
		/** Global default metadata visibility mode for the whole product table. */
		metadataMode,
		/** Set of temporary IDs for products currently being created. */
		pendingIds,
		/** Map of temporary IDs to error messages for failed creates. */
		failedIds,
		/** Callback to save edits for an existing product. */
		onsave,
		/** Callback to delete an existing product. */
		ondelete,
		/** Callback to retry a failed create. */
		onretry,
		/** Callback to dismiss a failed create. */
		ondismiss,
		/** Callback to update an unsaved draft row. */
		onupdateProductDraft,
		/** Callback to save an unsaved draft row. */
		onsaveProductDraft,
		/** Callback to cancel an unsaved draft row. */
		oncancelProductDraft,
		/** Callback to create a new bit. */
		onCreateBit
	}: {
		products: SellerProduct[];
		productDrafts: ProductDraft[];
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		metadataMode: TableDetailMode;
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
		onupdateProductDraft: (draftId: string, patch: ProductDraftPatch) => void;
		onsaveProductDraft: (draftId: string) => void | Promise<void>;
		oncancelProductDraft: (draftId: string) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	/** Reference to the list wrapper for DOM-based keyboard navigation queries. */
	let listEl: HTMLDivElement | null = $state(null);

	/** Shared edit-mode context set by the parent route. Null when used standalone. */
	const tableEditModeContext = getTableEditModeContext();

	/** Whether the table is currently in edit mode. Defaults to true when no context is set. */
	let editMode = $derived(tableEditModeContext ? tableEditModeContext.editMode() : true);

	/**
	 * Tier-1 column order for arrow key navigation.
	 * Arrow keys only move between the row name cell and the actions cell.
	 */
	let colOrder = $derived(['name', 'actions']);

	/**
	 * Full column order for Tab navigation.
	 * Tab walks tier 1 and then the mounted metadata fields for expanded rows.
	 */
	const tabOrder = ['name', 'actions', 'bits', 'processes', 'allergens'];

	/**
	 * Indices of selectable rows for keyboard navigation.
	 * Pending and failed saved-product rows are skipped, but draft rows stay selectable.
	 */
	let selectableRowIndices = $derived.by(() => {
		const savedRowIndices = products
			.map((product, index) => ({
				index,
				isSelectable: !pendingIds.has(product.id) && !failedIds.has(product.id)
			}))
			.filter((row) => row.isSelectable)
			.map((row) => row.index);

		const draftRowIndices = productDrafts.map((_, draftIndex) => products.length + draftIndex);

		return [...savedRowIndices, ...draftRowIndices];
	});

	/** Find the next selectable row index in a given direction. */
	function nextSelectableRow(currentRow: number, direction: 1 | -1): number | null {
		const currentPosition = selectableRowIndices.indexOf(currentRow);
		if (currentPosition === -1) {
			return direction === 1
				? (selectableRowIndices.find((index) => index > currentRow) ?? null)
				: ([...selectableRowIndices].reverse().find((index) => index < currentRow) ?? null);
		}

		const nextPosition = currentPosition + direction;
		if (nextPosition < 0 || nextPosition >= selectableRowIndices.length) return null;
		return selectableRowIndices[nextPosition];
	}

	/** Get the row / column of the currently focused element inside the list. */
	function getCurrentCell(): { row: number; col: string } | null {
		const activeElement = document.activeElement;
		if (!activeElement || !listEl?.contains(activeElement)) return null;

		const cellElement = activeElement.closest('[data-row][data-col]') as HTMLElement | null;
		if (!cellElement) return null;

		return {
			row: parseInt(cellElement.dataset.row!, 10),
			col: cellElement.dataset.col!
		};
	}

	/** Focus the first focusable element inside the requested cell. */
	function focusCell(row: number, col: string): boolean {
		const focusableElement = listEl?.querySelector(
			`[data-row="${row}"][data-col="${col}"] [data-focusable]`
		) as HTMLElement | null;

		if (!focusableElement) return false;

		focusableElement.focus();
		focusableElement.scrollIntoView({ block: 'nearest' });
		return true;
	}

	/** Focus the last focusable element inside the requested cell. */
	function focusCellLast(row: number, col: string): boolean {
		const focusableElements = listEl?.querySelectorAll(
			`[data-row="${row}"][data-col="${col}"] [data-focusable]`
		);
		const focusableElement = focusableElements?.[focusableElements.length - 1] as HTMLElement | null;

		if (!focusableElement) return false;

		focusableElement.focus();
		focusableElement.scrollIntoView({ block: 'nearest' });
		return true;
	}

	/** Try to focus the next or previous focusable sibling inside the current cell. */
	function focusNextInCell(direction: 1 | -1): boolean {
		const activeElement = document.activeElement as HTMLElement | null;
		if (!activeElement) return false;

		const cellElement = activeElement.closest('[data-row][data-col]');
		if (!cellElement) return false;

		const focusableElements = Array.from(
			cellElement.querySelectorAll('[data-focusable]')
		) as HTMLElement[];
		const currentIndex = focusableElements.indexOf(activeElement);
		if (currentIndex === -1) return false;

		const nextIndex = currentIndex + direction;
		if (nextIndex >= 0 && nextIndex < focusableElements.length) {
			focusableElements[nextIndex].focus();
			return true;
		}

		return false;
	}

	/** Move focus to the adjacent tier-1 column, wrapping to the next selectable row when needed. */
	function moveToAdjacentCol(current: { row: number; col: string }, direction: 1 | -1) {
		const currentColumnIndex = colOrder.indexOf(current.col);
		if (currentColumnIndex === -1) return;

		const nextColumnIndex = currentColumnIndex + direction;
		if (nextColumnIndex >= 0 && nextColumnIndex < colOrder.length) {
			if (direction === -1) {
				focusCellLast(current.row, colOrder[nextColumnIndex]);
			} else {
				focusCell(current.row, colOrder[nextColumnIndex]);
			}
			return;
		}

		if (direction === 1) {
			const nextRow = nextSelectableRow(current.row, 1);
			if (nextRow !== null) focusCell(nextRow, colOrder[0]);
		} else {
			const previousRow = nextSelectableRow(current.row, -1);
			if (previousRow !== null) {
				focusCellLast(previousRow, colOrder[colOrder.length - 1]);
			}
		}
	}

	/** Move focus through the full tab order, skipping metadata cells that are not currently mounted. */
	function moveToAdjacentTabCell(current: { row: number; col: string }, direction: 1 | -1) {
		const currentTabIndex = tabOrder.indexOf(current.col);
		if (currentTabIndex === -1) return;

		let nextTabIndex = currentTabIndex + direction;
		while (nextTabIndex >= 0 && nextTabIndex < tabOrder.length) {
			const nextColumn = tabOrder[nextTabIndex];
			const found =
				direction === -1
					? focusCellLast(current.row, nextColumn)
					: focusCell(current.row, nextColumn);
			if (found) return;
			nextTabIndex += direction;
		}

		if (direction === 1) {
			const nextRow = nextSelectableRow(current.row, 1);
			if (nextRow !== null) focusCell(nextRow, tabOrder[0]);
		} else {
			const previousRow = nextSelectableRow(current.row, -1);
			if (previousRow !== null) {
				for (let tabIndex = tabOrder.length - 1; tabIndex >= 0; tabIndex -= 1) {
					if (focusCellLast(previousRow, tabOrder[tabIndex])) return;
				}
			}
		}
	}

	/**
	 * Handle list-level keyboard navigation via event delegation.
	 * Arrow keys move through tier 1. Tab walks the full mounted row structure.
	 */
	function handleListKeydown(event: KeyboardEvent) {
		const currentCell = getCurrentCell();
		if (!currentCell) return;

		/** Whether the focused element is a text input rather than a checkbox. */
		const isTextInput =
			(event.target as HTMLElement).tagName === 'INPUT' &&
			(event.target as HTMLInputElement).type !== 'checkbox';

		/** Whether the focused element is a checkbox input. */
		const isCheckbox =
			(event.target as HTMLElement).tagName === 'INPUT' &&
			(event.target as HTMLInputElement).type === 'checkbox';

		switch (event.key) {
			case 'ArrowUp': {
				event.preventDefault();
				const previousRow = nextSelectableRow(currentCell.row, -1);
				if (previousRow !== null) {
					const targetColumn = colOrder.includes(currentCell.col) ? currentCell.col : 'name';
					focusCell(previousRow, targetColumn);
				}
				break;
			}
			case 'ArrowDown': {
				event.preventDefault();
				const nextRow = nextSelectableRow(currentCell.row, 1);
				if (nextRow !== null) {
					const targetColumn = colOrder.includes(currentCell.col) ? currentCell.col : 'name';
					focusCell(nextRow, targetColumn);
				}
				break;
			}
			case 'Enter': {
				if (isCheckbox) {
					event.preventDefault();
					(event.target as HTMLInputElement).click();
				}
				break;
			}
			case 'ArrowLeft': {
				if (isTextInput) {
					const inputElement = event.target as HTMLInputElement;
					if (inputElement.selectionStart !== 0 || inputElement.selectionEnd !== 0) return;
				}
				event.preventDefault();
				if (currentCell.col === 'actions' && focusNextInCell(-1)) break;
				moveToAdjacentCol(currentCell, -1);
				break;
			}
			case 'ArrowRight': {
				if (isTextInput) {
					const inputElement = event.target as HTMLInputElement;
					const inputLength = inputElement.value.length;
					if (inputElement.selectionStart !== inputLength || inputElement.selectionEnd !== inputLength) {
						return;
					}
				}
				event.preventDefault();
				if (currentCell.col === 'actions' && focusNextInCell(1)) break;
				moveToAdjacentCol(currentCell, 1);
				break;
			}
			case 'Tab': {
				event.preventDefault();
				const direction = event.shiftKey ? -1 : 1;
				if (currentCell.col === 'actions' && focusNextInCell(direction)) break;
				moveToAdjacentTabCell(currentCell, direction);
				break;
			}
		}
	}

	/** Names already taken by other rows when editing a saved product. */
	function getTakenProductNamesForSavedProduct(productId: string): string[] {
		return [
			...products.filter((product) => product.id !== productId).map((product) => product.name),
			...productDrafts.map((draftProduct) => draftProduct.name)
		];
	}

	/** Names already taken by other rows when editing an unsaved draft. */
	function getTakenProductNamesForDraftProduct(draftId: string): string[] {
		return [
			...products.map((product) => product.name),
			...productDrafts
				.filter((draftProduct) => draftProduct.id !== draftId)
				.map((draftProduct) => draftProduct.name)
		];
	}
</script>

{#if products.length === 0 && productDrafts.length === 0}
	<div class="flex items-center justify-center rounded-md border py-16">
		<p class="text-muted-foreground">No products yet. Use Add Product to create your first product.</p>
	</div>
{:else}
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
				takenProductNames={getTakenProductNamesForSavedProduct(product.id)}
				isPending={pendingIds.has(product.id)}
				isFailed={failedIds.has(product.id)}
				globalMetadataMode={metadataMode}
				{onsave}
				{ondelete}
				{onretry}
				{ondismiss}
				{onCreateBit}
			/>
		{/each}

		{#if editMode}
			{#each productDrafts as draftProduct, draftIndex (draftProduct.id)}
				<ProductListRowDraft
				{draftProduct}
				rowIndex={products.length + draftIndex}
				{allBits}
				{allProcesses}
				{allAllergenWarnings}
				takenProductNames={getTakenProductNamesForDraftProduct(draftProduct.id)}
				onsave={onsaveProductDraft}
				oncancel={oncancelProductDraft}
				onupdate={onupdateProductDraft}
				{onCreateBit}
				/>
			{/each}
		{/if}
	</div>
{/if}
