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
		/** Which metadata field editor is currently open. */
		activeField,
		/** Open the requested metadata editor. */
		onOpenEditor,
		/** Close the requested metadata editor if it is active. */
		onCloseEditorIfActive,
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
		activeField: 'bits' | 'processes' | 'allergens' | null;
		onOpenEditor: (field: 'bits' | 'processes' | 'allergens') => void;
		onCloseEditorIfActive: (field: 'bits' | 'processes' | 'allergens') => void;
		onBitsChange: (values: string[]) => void;
		onProcessesChange: (values: string[]) => void;
		onAllergensChange: (values: string[]) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	/** Capitalize the first letter of each word for display consistency with saved rows. */
	function titleCase(text: string): string {
		return text.replace(/\b\w/g, (character) => character.toUpperCase());
	}

	/** Resolved bit items currently selected on this draft row. */
	let displayBits = $derived(
		allBits.filter((bit) => draftProduct.bitIds.includes(bit.value))
	);

	/** Resolved processing items currently selected on this draft row. */
	let displayProcesses = $derived(
		allProcesses.filter((processItem) => draftProduct.processIds.includes(processItem.value))
	);

	/** Resolved allergen warning items currently selected on this draft row. */
	let displayAllergens = $derived(
		allAllergenWarnings.filter((allergen) => draftProduct.allergenIds.includes(allergen.value))
	);

	/** Format a list of selected items using the same inline text style as saved-row editing. */
	function formatList(items: { label: string }[], fallback: string): string {
		if (items.length === 0) return fallback;
		return items.map((item) => titleCase(item.label)).join(', ');
	}
</script>

<div class="-mt-2 space-y-0.5 overflow-visible px-3 pb-2.5 text-xs md:px-4 md:pb-4">
	<div data-row={rowIndex} data-col="bits" class="overflow-visible">
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
					selectedValues={draftProduct.bitIds}
					onchange={onBitsChange}
					onfocusleave={() => onCloseEditorIfActive('bits')}
					onCreate={onCreateBit}
					hidePills={true}
				/>
			</div>
		{/if}
	</div>

	<div data-row={rowIndex} data-col="processes" class="overflow-visible">
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
					selectedValues={draftProduct.processIds}
					onchange={onProcessesChange}
					onfocusleave={() => onCloseEditorIfActive('processes')}
					hidePills={true}
				/>
			</div>
		{/if}
	</div>

	<div data-row={rowIndex} data-col="allergens" class="overflow-visible">
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
			<span class="ml-2"
				>{displayAllergens.length > 0
					? displayAllergens
							.map((allergen) => titleCase(allergen.label.replace(/^May contain /i, '')))
							.join(', ')
					: '–'}</span
			>
		</div>

		{#if activeField === 'allergens'}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="max-w-xs pb-1" onclick={(event) => event.stopPropagation()}>
				<ProductListRowFieldsAllergenWarnings
					items={allAllergenWarnings}
					selectedValues={draftProduct.allergenIds}
					onchange={onAllergensChange}
					onfocusleave={() => onCloseEditorIfActive('allergens')}
					hidePills={true}
				/>
			</div>
		{/if}
	</div>
</div>
