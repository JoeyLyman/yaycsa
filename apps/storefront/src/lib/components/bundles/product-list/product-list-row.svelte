<script lang="ts">
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Button } from '$lib/components/bits/button';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import { TableRowHeader } from '$lib/components/blocks/table-row-header';
	import { TableRowActions } from '$lib/components/blocks/table-row-actions';
	import { TableRowEditActions } from '$lib/components/blocks/table-row-edit-actions';
	import { TableRowMetadataSummary } from '$lib/components/blocks/table-row-metadata-summary';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';
	import type { SellerProduct } from '$lib/api/admin/products.remote';
	import { hasDuplicateProductName } from '$lib/utils/product-name.js';
	import type { TableDetailMode } from '$lib/components/blocks/table-detail-toggle';
	import ProductListRowMetadata from './product-list-row-metadata.svelte';
	import { computeMetadataSummary } from './product-list-row-metadata-summary';

	/** Accumulated changes for this row. */
	interface EditState {
		name?: string;
		bitIds?: string[];
		processIds?: string[];
		allergenIds?: string[];
	}

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
		/** Global metadata visibility mode for the whole product table. */
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
		globalMetadataMode?: TableDetailMode;
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

	/**
	 * On entering edit mode, hydrate `editState` with the saved product values so every editor
	 * renders pre-populated. Skipped when `editState` is already populated so we don't clobber
	 * in-flight changes (e.g. mid-edit re-render after a sibling row saves).
	 */
	$effect(() => {
		if (editMode && !editState) {
			editState = {
				name: product.name,
				bitIds: product.bits.map((bit) => bit.id),
				processIds: product.processes.map((processItem) => processItem.id),
				allergenIds: product.allergenWarnings.map((allergen) => allergen.id)
			};
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

	/** Whether the metadata tier is currently visible for this row. */
	let showMetadata = $derived(globalMetadataMode === 'expanded');

	/**
	 * Whether the collapsed metadata summary line should be visible for this row.
	 * Only the summary mode shows this line.
	 */
	let showMetadataSummary = $derived(globalMetadataMode === 'summary');

	/** Structured summary segments for the collapsed metadata line. */
	let metadataSummary = $derived(
		computeMetadataSummary(displayBits, displayProcesses, displayAllergens)
	);

	/** Discard all pending edits for this row. The hydration effect will repopulate in edit mode. */
	function cancelEdits() {
		editState = null;
	}

	/** Save all accumulated edits for this row. */
	async function handleSave() {
		if (!editState || !canSave) return;

		// Compare actual values, not just `!== undefined`. The hydration $effect populates every
		// field on entering edit mode, so "defined" no longer implies "changed."
		const sortedIds = (ids: string[]) => [...ids].sort();
		const sameSet = (left: string[] | undefined, right: string[]) =>
			left !== undefined &&
			JSON.stringify(sortedIds(left)) === JSON.stringify(sortedIds(right));

		const bitsActuallyChanged =
			editState.bitIds !== undefined &&
			!sameSet(editState.bitIds, product.bits.map((bit) => bit.id));
		const processesActuallyChanged =
			editState.processIds !== undefined &&
			!sameSet(editState.processIds, product.processes.map((processItem) => processItem.id));
		const allergensActuallyChanged =
			editState.allergenIds !== undefined &&
			!sameSet(editState.allergenIds, product.allergenWarnings.map((allergen) => allergen.id));

		let facetValueIds: string[] | undefined;
		if (bitsActuallyChanged || processesActuallyChanged || allergensActuallyChanged) {
			const bitIds = editState.bitIds ?? product.bits.map((bit) => bit.id);
			const processIds =
				editState.processIds ?? product.processes.map((processItem) => processItem.id);
			const allergenIds =
				editState.allergenIds ?? product.allergenWarnings.map((allergen) => allergen.id);
			facetValueIds = [...bitIds, ...processIds, ...allergenIds];
		}

		const nextName = editState.name !== undefined ? editState.name.trim() : undefined;
		const nameActuallyChanged = nextName !== undefined && nextName !== product.name;

		if (!nameActuallyChanged && !facetValueIds) {
			cancelEdits();
			return;
		}

		saving = true;

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
</script>

<div
	data-product-row
	data-row={rowIndex}
	class="border-b last:border-b-0 {isPending
		? 'opacity-50'
		: isFailed
			? 'bg-destructive/5'
			: ''}"
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
					editing={editMode}
					dataFocusable={true}
					disabled={saving}
					oninput={(event) => {
						if (!editState) editState = {};
						editState.name = (event.currentTarget as HTMLInputElement).value;
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
				<TableRowEditActions
					{saving}
					{canSave}
					onsave={handleSave}
					oncancel={cancelEdits}
				/>
			{:else if editMode}
				<TableRowActions bind:open={confirmingDelete} disabled={deleting}>
					<Button size="sm" variant="destructive" disabled={deleting} data-focusable onclick={handleDelete}>
						{#if deleting}<SpinnerSun class="size-3.5" />{:else}Delete{/if}
					</Button>
				</TableRowActions>
			{/if}
		</div>
	</div>

	{#if showMetadataSummary}
		<TableRowMetadataSummary segments={metadataSummary} />
	{/if}

	{#if showMetadata}
		<ProductListRowMetadata
			{product}
			{rowIndex}
			{allBits}
			{allProcesses}
			{allAllergenWarnings}
			{editState}
			{isPending}
			{isFailed}
			{editMode}
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
