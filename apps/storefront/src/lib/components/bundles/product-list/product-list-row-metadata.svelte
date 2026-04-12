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
		/** Which field editor is currently open (null if none). */
		activeField,
		/** Accumulated edit state from parent row. */
		editState,
		/** Whether this product is in a pending-create state. */
		isPending = false,
		/** Whether this product failed to create. */
		isFailed = false,
		/** Callback to open an editor for a field. */
		onOpenEditor,
		/** Callback to close editor if the given field is active. */
		onCloseEditorIfActive,
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
		activeField: 'name' | 'bits' | 'processes' | 'allergens' | null;
		editState: {
			bitIds?: string[];
			processIds?: string[];
			allergenIds?: string[];
		} | null;
		isPending?: boolean;
		isFailed?: boolean;
		onOpenEditor: (field: 'bits' | 'processes' | 'allergens') => void;
		onCloseEditorIfActive: (field: 'bits' | 'processes' | 'allergens') => void;
		onBitsChange: (values: string[]) => void;
		onProcessesChange: (values: string[]) => void;
		onAllergensChange: (values: string[]) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	/** Capitalize the first letter of each word for summary display. */
	function titleCase(text: string): string {
		return text.replace(/\b\w/g, (character) => character.toUpperCase());
	}

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
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="inline-flex w-fit cursor-pointer items-baseline py-1"
				onclick={(event) => {
					event.stopPropagation();
					activeField === 'bits' ? onCloseEditorIfActive('bits') : onOpenEditor('bits');
				}}
				data-focusable
				data-auto-open
			>
				<span class="italic text-muted-foreground">Ingredients</span>
				<span class="ml-2">{formatList(displayBits, '–')}</span>
			</div>

			{#if activeField === 'bits'}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="max-w-xs pb-1" onclick={(event) => event.stopPropagation()}>
					<ProductListRowFieldsBits
						items={allBits}
						selectedValues={editState?.bitIds ?? product.bits.map((bit) => bit.id)}
						onchange={onBitsChange}
						onfocusleave={() => onCloseEditorIfActive('bits')}
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
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="inline-flex w-fit cursor-pointer items-baseline py-1"
				onclick={(event) => {
					event.stopPropagation();
					activeField === 'processes'
						? onCloseEditorIfActive('processes')
						: onOpenEditor('processes');
				}}
				data-focusable
				data-auto-open
			>
				<span class="italic text-muted-foreground">Processing</span>
				<span class="ml-2">{formatList(displayProcesses, '–')}</span>
			</div>

			{#if activeField === 'processes'}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="max-w-xs pb-1" onclick={(event) => event.stopPropagation()}>
					<ProductListRowFieldsProcesses
						items={allProcesses}
						selectedValues={editState?.processIds ?? product.processes.map((processItem) => processItem.id)}
						onchange={onProcessesChange}
						onfocusleave={() => onCloseEditorIfActive('processes')}
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
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="inline-flex w-fit cursor-pointer items-baseline py-1"
				onclick={(event) => {
					event.stopPropagation();
					activeField === 'allergens'
						? onCloseEditorIfActive('allergens')
						: onOpenEditor('allergens');
				}}
				data-focusable
				data-auto-open
			>
				<span class="italic text-muted-foreground">Allergens</span>
				<span class="ml-2">{displayAllergens.length > 0
					? displayAllergens
							.map((allergen) => titleCase(allergen.label.replace(/^May contain /i, '')))
							.join(', ')
					: '–'}</span>
			</div>

			{#if activeField === 'allergens'}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="max-w-xs pb-1" onclick={(event) => event.stopPropagation()}>
					<ProductListRowFieldsAllergenWarnings
						items={allAllergenWarnings}
						selectedValues={editState?.allergenIds ?? product.allergenWarnings.map((allergen) => allergen.id)}
						onchange={onAllergensChange}
						onfocusleave={() => onCloseEditorIfActive('allergens')}
						hidePills={true}
					/>
				</div>
			{/if}
		{/if}
	</div>
</div>
