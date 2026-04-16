<script lang="ts">
	import { tick } from 'svelte';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Button } from '$lib/components/bits/button';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import { TableRowHeader } from '$lib/components/blocks/table-row-header';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';
	import type { SellerProduct } from '$lib/api/admin/products.remote';
	import { hasDuplicateProductName } from '$lib/utils/product-name.js';
	import { nextProductMetadataMode } from './product-list-metadata-mode';
	import type { ProductMetadataMode } from './product-list-types';
	import ProductListRowMetadata from './product-list-row-metadata.svelte';
	import { computeMetadataSummary } from './product-list-row-metadata-summary';

	/** Accumulated changes for this row. */
	interface EditState {
		name?: string;
		bitIds?: string[];
		processIds?: string[];
		allergenIds?: string[];
	}

	type EditField = 'name' | 'bits' | 'processes' | 'allergens';

	let {
		/** The product data for this row. */
		product,
		/** The row's index in the product list (used for data-row). */
		rowIndex,
		/** All available bits (ingredients/components). */
		allBits,
		/** All available processing types. */
		allProcesses,
		/** All available allergen warnings. */
		allAllergenWarnings,
		/** Names already used by other saved products or draft rows. */
		takenProductNames = [],
		/** Whether this product is in a pending-create state. */
		isPending = false,
		/** Whether this product failed to create. */
		isFailed = false,
		/** Global default metadata visibility mode for the whole product table. */
		globalMetadataMode = 'summary',
		/** Callback to save accumulated edits. */
		onsave,
		/** Callback to delete this product. */
		ondelete,
		/** Callback to retry a failed create. */
		onretry,
		/** Callback to dismiss a failed create. */
		ondismiss,
		/** Callback to create a new bit (ingredient). */
		onCreateBit
	}: {
		product: SellerProduct;
		rowIndex: number;
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		takenProductNames?: string[];
		isPending?: boolean;
		isFailed?: boolean;
		globalMetadataMode?: ProductMetadataMode;
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

	/** Shared edit-mode context from the parent list. Null when used standalone. */
	const tableEditModeContext = getTableEditModeContext();

	/** Whether the table is currently in edit mode. Defaults to true when no context is set. */
	let editMode = $derived(tableEditModeContext ? tableEditModeContext.editMode() : true);

	/** Accumulated edits for this row. null when not editing. */
	let editState = $state<EditState | null>(null);

	/** Which field editor is currently open. null when no editor is active. */
	let activeField: EditField | null = $state(null);

	/** Whether this row is currently saving edits. */
	let saving = $state(false);

	/** Whether this row is in delete-confirm mode. */
	let confirmingDelete = $state(false);

	/** Whether a delete is currently in flight for this row. */
	let deleting = $state(false);

	/**
	 * Trimmed version of the edited name.
	 * Leading and trailing whitespace never count as meaningful product changes.
	 */
	let trimmedEditedName = $derived(editState?.name?.trim() ?? product.name);

	/**
	 * Whether the edited name is actually different from the saved product name.
	 * This uses the trimmed value so whitespace-only edits collapse away naturally.
	 */
	let nameChanged = $derived(editState?.name !== undefined && trimmedEditedName !== product.name);

	/**
	 * Inline duplicate-name error for this row.
	 * Only applies while the seller has an edited name in flight.
	 */
	let nameError = $derived(
		editState?.name !== undefined &&
		trimmedEditedName !== product.name &&
		hasDuplicateProductName(editState.name, takenProductNames)
			? 'A product with this name already exists'
			: null
	);

	/**
	 * Whether the edited name is long enough to save.
	 * Rows that are only editing metadata skip this check because their name is unchanged.
	 */
	let hasValidEditedName = $derived(
		editState?.name === undefined || editState.name.trim().length >= 3
	);

	/**
	 * Whether any field has a real saved-data change pending.
	 * This drives Save/Cancel visibility for existing rows.
	 */
	let isEditing = $derived.by(() => {
		const bitsChanged =
			editState?.bitIds !== undefined &&
			JSON.stringify([...editState.bitIds].sort()) !==
				JSON.stringify(product.bits.map((bit) => bit.id).sort());
		const processChanged =
			editState?.processIds !== undefined &&
			JSON.stringify([...editState.processIds].sort()) !==
				JSON.stringify(product.processes.map((processItem) => processItem.id).sort());
		const allergensChanged =
			editState?.allergenIds !== undefined &&
			JSON.stringify([...editState.allergenIds].sort()) !==
				JSON.stringify(product.allergenWarnings.map((allergen) => allergen.id).sort());

		return nameChanged || bitsChanged || processChanged || allergensChanged;
	});

	/**
	 * Whether the Save button should be enabled for this row.
	 * Existing rows must have real changes, a long-enough edited name, and no duplicate-name error.
	 */
	let canSave = $derived(isEditing && hasValidEditedName && !nameError);

	/** Register this row's dirty flag with the shared edit-mode context. */
	$effect(() => {
		if (!tableEditModeContext) return;
		tableEditModeContext.registerDirty(product.id, isEditing);
		return () => tableEditModeContext.unregisterDirty(product.id);
	});

	/** When edit mode turns off mid-edit, close any open field editor. */
	$effect(() => {
		if (!editMode) {
			activeField = null;
		}
	});

	/** Display name shown in the row while edits are pending. */
	let displayName = $derived(editState?.name ?? product.name);

	/** Resolved bit items used for the collapsed metadata summary line. */
	let displayBits = $derived(
		allBits.filter((bit) => (editState?.bitIds ?? product.bits.map((productBit) => productBit.id)).includes(bit.value))
	);

	/** Resolved process items used for the collapsed metadata summary line. */
	let displayProcesses = $derived(
		allProcesses.filter((processItem) =>
			(editState?.processIds ?? product.processes.map((productProcess) => productProcess.id)).includes(
				processItem.value
			)
		)
	);

	/** Resolved allergen items used for the collapsed metadata summary line. */
	let displayAllergens = $derived(
		allAllergenWarnings.filter((allergen) =>
			(editState?.allergenIds ?? product.allergenWarnings.map((productAllergen) => productAllergen.id)).includes(
				allergen.value
			)
		)
	);

	/**
	 * Per-row metadata mode override.
	 * Null means "follow the current global metadata mode from the parent list".
	 */
	let metadataModeOverride: ProductMetadataMode | null = $state(null);

	/**
	 * Previous value of the global metadata mode.
	 * Stored outside reactivity so we can detect real parent-toggle changes.
	 */
	let previousGlobalMetadataMode: ProductMetadataMode | undefined;

	$effect(() => {
		const currentGlobalMetadataMode = globalMetadataMode;
		if (
			previousGlobalMetadataMode !== undefined &&
			currentGlobalMetadataMode !== previousGlobalMetadataMode
		) {
			metadataModeOverride = null;
		}
		previousGlobalMetadataMode = currentGlobalMetadataMode;
	});

	/** Effective metadata mode after combining the global mode with any per-row override. */
	let effectiveMetadataMode = $derived(
		(metadataModeOverride ?? globalMetadataMode) as ProductMetadataMode
	);

	/** Whether the metadata tier is currently visible for this row. */
	let showMetadata = $derived(effectiveMetadataMode === 'expanded');

	/**
	 * Whether the collapsed metadata summary line should be visible for this row.
	 * Only the summary mode shows this line.
	 */
	let showMetadataSummary = $derived(effectiveMetadataMode === 'summary');

	/** Structured summary segments for the collapsed metadata line. */
	let metadataSummary = $derived(
		computeMetadataSummary(displayBits, displayProcesses, displayAllergens)
	);

	/**
	 * When focus leaves this row and no real edits remain, close the row editor state.
	 * Rows keep accumulated edits when changes exist so Save / Cancel stay available.
	 */
	function handleRowFocusOut(event: FocusEvent) {
		const relatedTarget = event.relatedTarget as Node | null;
		if (!relatedTarget) return;

		const rowElement = event.currentTarget as HTMLElement;
		if (rowElement.contains(relatedTarget)) return;

		confirmingDelete = false;

		if (!isEditing) {
			activeField = null;
			editState = null;
		} else {
			activeField = null;
		}
	}

	/**
	 * When an editor opens, wait for the DOM update and then focus the field's first input.
	 * This keeps click and keyboard-open interactions consistent across row cells.
	 */
	$effect(() => {
		if (activeField !== null) {
			tick().then(() => {
				const rowElement =
					document
						.querySelector(`[data-row="${rowIndex}"]`)
						?.closest('[data-product-row]') ??
					document.querySelector(`[data-product-row]:has([data-row="${rowIndex}"])`);
				const cellElement = rowElement?.querySelector(`[data-col="${activeField}"]`);
				const focusableElement = cellElement?.querySelector('[data-focusable]') as HTMLElement | null;
				focusableElement?.focus();
			});
		}
	});

	/** Initialize edit state if needed, then open a field editor. */
	function openEditor(field: EditField) {
		if (!editState) {
			editState = {};
		}
		const currentEditState = editState;
		activeField = field;

		if (field === 'bits' || field === 'processes' || field === 'allergens') {
			metadataModeOverride = 'expanded';
		}

		if (field === 'name' && currentEditState.name === undefined) {
			currentEditState.name = product.name;
		} else if (field === 'bits' && currentEditState.bitIds === undefined) {
			currentEditState.bitIds = product.bits.map((bit) => bit.id);
		} else if (field === 'processes' && currentEditState.processIds === undefined) {
			currentEditState.processIds = product.processes.map((processItem) => processItem.id);
		} else if (field === 'allergens' && currentEditState.allergenIds === undefined) {
			currentEditState.allergenIds = product.allergenWarnings.map((allergen) => allergen.id);
		}
	}

	/** Close the active editor. Clear edit state entirely if no real changes remain. */
	function closeEditor() {
		activeField = null;
		if (!isEditing) {
			editState = null;
		}
	}

	/** Close a specific metadata editor when its InputSelect fully loses focus. */
	function closeEditorIfActive(field: 'bits' | 'processes' | 'allergens') {
		if (activeField === field) {
			closeEditor();
		}
	}

	/** Discard all pending edits for this row. */
	function cancelEdits() {
		editState = null;
		activeField = null;
	}

	/** Save all accumulated edits for this row. */
	async function handleSave() {
		if (!editState || !canSave) return;

		const bitsChanged = editState.bitIds !== undefined;
		const processChanged = editState.processIds !== undefined;
		const allergensChanged = editState.allergenIds !== undefined;

		let facetValueIds: string[] | undefined;
		if (bitsChanged || processChanged || allergensChanged) {
			const bitIds = editState.bitIds ?? product.bits.map((bit) => bit.id);
			const processIds = editState.processIds ?? product.processes.map((processItem) => processItem.id);
			const allergenIds = editState.allergenIds ?? product.allergenWarnings.map((allergen) => allergen.id);
			facetValueIds = [...bitIds, ...processIds, ...allergenIds];
		}

		const nextName = editState.name !== undefined ? editState.name.trim() : undefined;
		const nameActuallyChanged = nextName !== undefined && nextName !== product.name;

		if (!nameActuallyChanged && !facetValueIds) {
			cancelEdits();
			return;
		}

		saving = true;
		activeField = null;

		try {
			await onsave(product.id, {
				...(nameActuallyChanged ? { name: nextName } : {}),
				...(facetValueIds ? { facetValueIds } : {})
			});
			editState = null;
		} catch (error) {
			console.error('Failed to save product:', error);
		}

		saving = false;
	}

	/** Delete this row after the inline confirmation step. */
	async function handleDelete() {
		deleting = true;
		try {
			await ondelete(product.id);
		} catch (error) {
			console.error('Failed to delete product:', error);
		}
		deleting = false;
		confirmingDelete = false;
	}

	/**
	 * Toggle the metadata section when the non-interactive part of the row is clicked.
	 * Buttons and inputs keep their own behavior and never trigger row collapse.
	 */
	function handleRowClick(event: MouseEvent) {
		if (!editMode) return;
		const target = event.target as HTMLElement;
		if (target.closest('button') || target.closest('input')) {
			return;
		}
		activeField = null;
		metadataModeOverride = nextProductMetadataMode(effectiveMetadataMode);
	}
</script>

<!-- Row container: uses data-product-row for focusout and focus-on-edit. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	data-product-row
	data-row={rowIndex}
	class="border-b last:border-b-0 {editMode ? 'cursor-pointer' : ''} {isPending
		? 'opacity-50'
		: isFailed
			? 'bg-destructive/5'
			: ''}"
	onfocusout={handleRowFocusOut}
	onclick={handleRowClick}
>
	<div class="flex min-h-11 items-start gap-2 px-3 pt-[8px] pb-1 md:gap-3 md:px-4 md:pt-[10px] md:pb-1.5">
		<div class="min-w-0 shrink" data-col="name">
			{#if isPending}
				<span class="inline-flex min-h-8 items-center gap-2 text-[17px] font-medium leading-tight">
					<SpinnerSun class="size-3.5 shrink-0 text-muted-foreground" />
					<span class="truncate">{product.name}</span>
				</span>
			{:else if isFailed}
				<span class="inline-flex min-h-8 items-center truncate text-[17px] font-medium leading-tight text-destructive">{product.name}</span>
			{:else}
				<TableRowHeader
					value={displayName}
					error={nameError}
					editing={activeField === 'name'}
					dataFocusable={true}
					disabled={saving}
					onopenedit={editMode ? () => openEditor('name') : undefined}
					oninput={(event) => {
						if (!editState) editState = {};
						editState.name = (event.currentTarget as HTMLInputElement).value;
					}}
					onblur={closeEditor}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.stopPropagation();
							closeEditor();
						}
						if (event.key === 'Escape') {
							event.stopPropagation();
							cancelEdits();
						}
					}}
				/>
			{/if}
		</div>

		<div class="flex-1"></div>

		<div class="shrink-0" data-col="actions">
			{#if isPending}
				<span class="inline-flex h-8 items-center text-xs text-muted-foreground">Saving...</span>
			{:else if isFailed}
				<div class="flex items-center gap-1">
					<Button size="sm" variant="ghost" data-focusable onclick={() => onretry(product.id)} class="text-xs">
						Retry
					</Button>
					<Button
						size="sm"
						variant="ghost"
						data-focusable
						onclick={() => ondismiss(product.id)}
						class="text-xs text-destructive hover:text-destructive"
					>
						Dismiss
					</Button>
				</div>
			{:else if isEditing}
				<div class="flex items-center gap-1">
					<Button size="sm" disabled={saving || !canSave} data-focusable onclick={handleSave}>
						{#if saving}
							<SpinnerSun class="size-3.5" />
						{:else}
							Save
						{/if}
					</Button>
					<Button size="sm" variant="ghost" disabled={saving} data-focusable onclick={cancelEdits}>
						Cancel
					</Button>
				</div>
			{:else if confirmingDelete}
				<div class="flex items-center gap-1">
					<Button size="sm" variant="destructive" disabled={deleting} data-focusable onclick={handleDelete}>
						{#if deleting}<SpinnerSun class="size-3.5" />{:else}Delete{/if}
					</Button>
					<Button size="sm" variant="ghost" data-focusable onclick={() => (confirmingDelete = false)}>
						Cancel
					</Button>
				</div>
			{:else if editMode}
				<button
					class="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
					data-focusable
					onclick={() => (confirmingDelete = true)}
					title="More actions"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="5" r="1" />
						<circle cx="12" cy="12" r="1" />
						<circle cx="12" cy="19" r="1" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	{#if showMetadataSummary}
		<div class="-mt-1 truncate px-3 pb-3 text-xs text-muted-foreground md:px-4">
			{#each metadataSummary as segment}
				{#if segment.italic}
					<span class="{segment.section ? 'ml-4' : ''} italic">{segment.text}</span>
				{:else}
					<span class="{segment.spaced ? 'ml-2' : ''} text-foreground">{segment.text}</span>
				{/if}
			{/each}
		</div>
	{/if}

	{#if showMetadata}
		<ProductListRowMetadata
			{product}
			{rowIndex}
			{allBits}
			{allProcesses}
			{allAllergenWarnings}
			{activeField}
			{editState}
			{isPending}
			{isFailed}
			{editMode}
			onOpenEditor={openEditor}
			onCloseEditorIfActive={closeEditorIfActive}
			onBitsChange={(bitIds: string[]) => {
				if (!editState) editState = {};
				editState.bitIds = bitIds;
			}}
			onProcessesChange={(processIds: string[]) => {
				if (!editState) editState = {};
				editState.processIds = processIds;
			}}
			onAllergensChange={(allergenIds: string[]) => {
				if (!editState) editState = {};
				editState.allergenIds = allergenIds;
			}}
			{onCreateBit}
		/>
	{/if}
</div>
