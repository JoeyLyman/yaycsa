<script lang="ts">
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import {
		ProductListRowFieldsAllergenWarnings,
		ProductListRowFieldsBits,
		ProductListRowFieldsProcesses
	} from '$lib/components/blocks/product-list-row-fields';
	import type { ProductDraft } from './product-list-types';

	let {
		/** The unsaved draft values currently shown in this metadata section. */
		draftProduct,
		/** The row index used by list-level keyboard navigation. */
		rowIndex,
		/** All available ingredient / component options. */
		allBits,
		/** All available processing options. */
		allProcesses,
		/** All available allergen warning options. */
		allAllergenWarnings,
		/** Apply new bit selections to the parent draft row. */
		onBitsChange,
		/** Apply new processing selections to the parent draft row. */
		onProcessesChange,
		/** Apply new allergen selections to the parent draft row. */
		onAllergensChange,
		/** Create a new bit option on demand. */
		onCreateBit
	}: {
		draftProduct: ProductDraft;
		rowIndex: number;
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		onBitsChange: (values: string[]) => void;
		onProcessesChange: (values: string[]) => void;
		onAllergensChange: (values: string[]) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();
</script>

<div class="-mt-2 space-y-0.5 overflow-visible px-3 pb-2.5 text-xs md:px-4 md:pb-4">
	<div data-row={rowIndex} data-col="bits" class="overflow-visible">
		<div class="inline-flex w-fit items-baseline py-1">
			<span class="italic text-muted-foreground">Ingredients</span>
		</div>
		<div class="max-w-xs pb-1">
			<ProductListRowFieldsBits
				items={allBits}
				selectedValues={draftProduct.bitIds}
				onchange={onBitsChange}
				onCreate={onCreateBit}
				hidePills={true}
			/>
		</div>
	</div>

	<div data-row={rowIndex} data-col="processes" class="overflow-visible">
		<div class="inline-flex w-fit items-baseline py-1">
			<span class="italic text-muted-foreground">Processing</span>
		</div>
		<div class="max-w-xs pb-1">
			<ProductListRowFieldsProcesses
				items={allProcesses}
				selectedValues={draftProduct.processIds}
				onchange={onProcessesChange}
				hidePills={true}
			/>
		</div>
	</div>

	<div data-row={rowIndex} data-col="allergens" class="overflow-visible">
		<div class="inline-flex w-fit items-baseline py-1">
			<span class="italic text-muted-foreground">Allergens</span>
		</div>
		<div class="max-w-xs pb-1">
			<ProductListRowFieldsAllergenWarnings
				items={allAllergenWarnings}
				selectedValues={draftProduct.allergenIds}
				onchange={onAllergensChange}
				hidePills={true}
			/>
		</div>
	</div>
</div>
