<script lang="ts">
	import type { SellerProduct } from '$lib/api/admin/products.remote';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import {
		ProductListRowFieldsAllergenWarnings,
		ProductListRowFieldsBits,
		ProductListRowFieldsProcesses
	} from '$lib/components/blocks/product-list-row-fields';

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
		/** Accumulated edit state from parent row. */
		editState,
		/** Whether this product is in a pending-create state. */
		isPending = false,
		/** Whether this product failed to create. */
		isFailed = false,
		/** Whether the parent table is currently in edit mode. View mode is fully read-only. */
		editMode = true,
		/** Callback when bits selection changes. */
		onBitsChange,
		/** Callback when processes selection changes. */
		onProcessesChange,
		/** Callback when allergens selection changes. */
		onAllergensChange,
		/** Callback to create a new bit (ingredient). */
		onCreateBit
	}: {
		product: SellerProduct;
		rowIndex: number;
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		editState: {
			bitIds?: string[];
			processIds?: string[];
			allergenIds?: string[];
		} | null;
		isPending?: boolean;
		isFailed?: boolean;
		editMode?: boolean;
		onBitsChange: (values: string[]) => void;
		onProcessesChange: (values: string[]) => void;
		onAllergensChange: (values: string[]) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	/** Capitalize the first letter of each word for summary display. */
	function titleCase(text: string): string {
		return text.replace(/\b\w/g, (character) => character.toUpperCase());
	}

	/**
	 * Whether all field editors should render simultaneously.
	 * True in edit mode so sellers see and tab between every editor at once.
	 */
	let allFieldsOpen = $derived(editMode);

	/** Resolved bit items for display from edit state when present, otherwise product data. */
	let displayBits = $derived(
		allBits.filter((bit) => (editState?.bitIds ?? product.bits.map((productBit) => productBit.id)).includes(bit.value))
	);

	/** Resolved processing items for display from edit state when present, otherwise product data. */
	let displayProcesses = $derived(
		allProcesses.filter((processItem) =>
			(editState?.processIds ?? product.processes.map((productProcess) => productProcess.id)).includes(
				processItem.value
			)
		)
	);

	/** Resolved allergen items for display from edit state when present, otherwise product data. */
	let displayAllergens = $derived(
		allAllergenWarnings.filter((allergen) =>
			(editState?.allergenIds ?? product.allergenWarnings.map((productAllergen) => productAllergen.id)).includes(
				allergen.value
			)
		)
	);

	/** Format a list of selected items for the collapsed summary line. */
	function formatList(items: { label: string }[], fallback: string): string {
		if (items.length === 0) return fallback;
		return items.map((item) => titleCase(item.label)).join(', ');
	}
</script>

<div class="-mt-2 space-y-0.5 overflow-visible px-3 pb-2.5 text-xs md:px-4 md:pb-4">
	<div data-row={rowIndex} data-col="bits" class="overflow-visible">
		{#if isPending || isFailed}
			<div class="inline-flex items-baseline py-1">
				<span class="italic text-muted-foreground">Ingredients</span>
				<span class="ml-2">{product.bits.length > 0 ? product.bits.map((bit) => titleCase(bit.name)).join(', ') : '–'}</span>
			</div>
		{:else}
			<div class="inline-flex w-fit items-baseline py-1">
				<span class="italic text-muted-foreground">Ingredients</span>
				<span class="ml-2">{formatList(displayBits, '–')}</span>
			</div>

			{#if allFieldsOpen}
				<div class="max-w-xs pb-1">
					<ProductListRowFieldsBits
						items={allBits}
						selectedValues={editState?.bitIds ?? product.bits.map((bit) => bit.id)}
						onchange={onBitsChange}
						onCreate={onCreateBit}
						hidePills={true}
					/>
				</div>
			{/if}
		{/if}
	</div>

	<div data-row={rowIndex} data-col="processes" class="overflow-visible">
		{#if isPending || isFailed}
			<div class="inline-flex items-baseline py-1">
				<span class="italic text-muted-foreground">Processing</span>
				<span class="ml-2">{product.processes.length > 0
					? product.processes.map((processItem) => titleCase(processItem.name)).join(', ')
					: '–'}</span>
			</div>
		{:else}
			<div class="inline-flex w-fit items-baseline py-1">
				<span class="italic text-muted-foreground">Processing</span>
				<span class="ml-2">{formatList(displayProcesses, '–')}</span>
			</div>

			{#if allFieldsOpen}
				<div class="max-w-xs pb-1">
					<ProductListRowFieldsProcesses
						items={allProcesses}
						selectedValues={editState?.processIds ?? product.processes.map((processItem) => processItem.id)}
						onchange={onProcessesChange}
						hidePills={true}
					/>
				</div>
			{/if}
		{/if}
	</div>

	<div data-row={rowIndex} data-col="allergens" class="overflow-visible">
		{#if isPending || isFailed}
			<div class="inline-flex items-baseline py-1">
				<span class="italic text-muted-foreground">Allergens</span>
				<span class="ml-2">{product.allergenWarnings.length > 0
					? product.allergenWarnings
							.map((allergen) => titleCase(allergen.name.replace(/^May contain /i, '')))
							.join(', ')
					: '–'}</span>
			</div>
		{:else}
			<div class="inline-flex w-fit items-baseline py-1">
				<span class="italic text-muted-foreground">Allergens</span>
				<span class="ml-2">{displayAllergens.length > 0
					? displayAllergens
							.map((allergen) => titleCase(allergen.label.replace(/^May contain /i, '')))
							.join(', ')
					: '–'}</span>
			</div>

			{#if allFieldsOpen}
				<div class="max-w-xs pb-1">
					<ProductListRowFieldsAllergenWarnings
						items={allAllergenWarnings}
						selectedValues={editState?.allergenIds ?? product.allergenWarnings.map((allergen) => allergen.id)}
						onchange={onAllergensChange}
						hidePills={true}
					/>
				</div>
			{/if}
		{/if}
	</div>
</div>
