<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Button } from '$lib/components/bits/button';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import { ProductListRowFieldsName } from '$lib/components/blocks/product-list-row-fields';
	import { hasDuplicateProductName } from '$lib/utils/product-name.js';
	import type { ProductDraft, ProductDraftPatch } from './product-list-types';
	import ProductListRowDraftMetadata from './product-list-row-draft-metadata.svelte';

	let {
		/** The unsaved draft data for this inline row. */
		draftProduct,
		/** The row's current list index for keyboard navigation data attributes. */
		rowIndex,
		/** All available ingredient / component options. */
		allBits,
		/** All available processing options. */
		allProcesses,
		/** All available allergen warning options. */
		allAllergenWarnings,
		/** Names already used by other saved products or draft rows. */
		takenProductNames,
		/** Persist this draft as a real product. */
		onsave,
		/** Remove this unsaved draft row from the table. */
		oncancel,
		/** Apply a partial update to this draft as the seller types. */
		onupdate,
		/** Create a new bit (ingredient) option on demand. */
		onCreateBit
	}: {
		draftProduct: ProductDraft;
		rowIndex: number;
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		takenProductNames: string[];
		onsave: (draftId: string) => void | Promise<void>;
		oncancel: (draftId: string) => void;
		onupdate: (draftId: string, patch: ProductDraftPatch) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	/** Reference to the draft name input so a newly added row can autofocus it. */
	let nameInputEl: HTMLInputElement | null = $state(null);

	/**
	 * Trimmed draft name used for Save-button gating.
	 * This ignores accidental leading/trailing spaces while the seller types.
	 */
	let trimmedDraftName = $derived(draftProduct.name.trim());

	/**
	 * Inline duplicate-name error for this draft row.
	 * Null when the current name is unique or still blank.
	 */
	let nameError = $derived(
		hasDuplicateProductName(draftProduct.name, takenProductNames)
			? 'A product with this name already exists'
			: null
	);

	/**
	 * Whether this draft row has a valid enough name to create a product.
	 * Save stays disabled until the seller enters at least 3 trimmed characters.
	 */
	let hasMinimumDraftNameLength = $derived(trimmedDraftName.length >= 3);

	/**
	 * Whether the Save button should be enabled for this draft row.
	 * A draft can save only when the name is long enough and not duplicated.
	 */
	let canSaveDraft = $derived(hasMinimumDraftNameLength && !nameError);

	onMount(async () => {
		await tick();
		nameInputEl?.focus();
	});
</script>

<div data-product-row data-row={rowIndex} class="border-b last:border-b-0">
	<div class="flex min-h-11 items-start gap-2 px-3 pt-[8px] pb-1 md:gap-3 md:px-4 md:pt-[10px] md:pb-1.5">
		<div class="min-w-0 flex-1" data-col="name">
			<ProductListRowFieldsName
				bind:ref={nameInputEl}
				value={draftProduct.name}
				error={nameError}
				placeholder="i.e. Beer, salad greens, whiskey marinated pork loins..."
				dataFocusable={true}
				oninput={(event) => {
					onupdate(draftProduct.id, {
						name: (event.currentTarget as HTMLInputElement).value
					});
				}}
				onkeydown={(event) => {
					if (event.key === 'Escape') {
						event.stopPropagation();
						oncancel(draftProduct.id);
					}

					if (event.key === 'Enter' && canSaveDraft) {
						event.preventDefault();
						event.stopPropagation();
						onsave(draftProduct.id);
					}
				}}
			/>
		</div>

		<div class="shrink-0" data-col="actions">
			<div class="flex items-center gap-1">
				<Button size="sm" disabled={!canSaveDraft} data-focusable onclick={() => onsave(draftProduct.id)}>
					Save New Product
				</Button>
				<Button size="sm" variant="ghost" data-focusable onclick={() => oncancel(draftProduct.id)}>
					Cancel
				</Button>
			</div>
		</div>
	</div>

	<ProductListRowDraftMetadata
		{draftProduct}
		{rowIndex}
		{allBits}
		{allProcesses}
		{allAllergenWarnings}
		onBitsChange={(bitIds: string[]) => onupdate(draftProduct.id, { bitIds })}
		onProcessesChange={(processIds: string[]) => onupdate(draftProduct.id, { processIds })}
		onAllergensChange={(allergenIds: string[]) => onupdate(draftProduct.id, { allergenIds })}
		{onCreateBit}
	/>
</div>
