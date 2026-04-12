<script lang="ts">
	import { InputSelect, type InputSelectItem } from '$lib/components/blocks/input-select';
	import type { SellerProduct } from '$lib/api/admin/products.remote';

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
		/** Whether the row is currently saving. */
		saving = false,
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
		activeField: 'name' | 'unitType' | 'bits' | 'processes' | 'allergens' | null;
		editState: {
			bitIds?: string[];
			processIds?: string[];
			allergenIds?: string[];
		} | null;
		isPending?: boolean;
		isFailed?: boolean;
		saving?: boolean;
		onOpenEditor: (field: 'bits' | 'processes' | 'allergens') => void;
		onCloseEditorIfActive: (field: 'bits' | 'processes' | 'allergens') => void;
		onBitsChange: (values: string[]) => void;
		onProcessesChange: (values: string[]) => void;
		onAllergensChange: (values: string[]) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	/** Capitalize the first letter of each word. */
	function titleCase(s: string): string {
		return s.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	// ─── Display values (edited or original) ───

	/** Resolved bit items for display (from edit state or product data). */
	let displayBits = $derived(
		allBits.filter((b) =>
			(editState?.bitIds ?? product.bits.map((b) => b.id)).includes(b.value)
		)
	);

	/** Resolved process items for display. */
	let displayProcesses = $derived(
		allProcesses.filter((p) =>
			(editState?.processIds ?? product.processes.map((p) => p.id)).includes(p.value)
		)
	);

	/** Resolved allergen items for display. */
	let displayAllergens = $derived(
		allAllergenWarnings.filter((a) =>
			(editState?.allergenIds ?? product.allergenWarnings.map((a) => a.id)).includes(a.value)
		)
	);

	/** Format a list of items as a comma-separated title-cased string. */
	function formatList(items: { label: string }[], fallback: string): string {
		if (items.length === 0) return fallback;
		return items.map((i) => titleCase(i.label)).join(', ');
	}
</script>

<div class="-mt-2 space-y-0.5 overflow-visible px-3 pb-2.5 text-xs md:px-4 md:pb-4">
	<!-- Bits / Ingredients -->
	<div data-row={rowIndex} data-col="bits" class="overflow-visible">
		{#if isPending || isFailed}
			<div class="py-1">
				<span class="italic text-muted-foreground">Ingredients</span><span class="ml-2">{product.bits.length > 0 ? product.bits.map((b) => titleCase(b.name)).join(', ') : '–'}</span>
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="w-fit cursor-pointer py-1"
				onclick={(e) => { e.stopPropagation(); if (activeField !== 'bits') onOpenEditor('bits'); }}
				data-focusable
				data-auto-open
			>
				<span class="italic text-muted-foreground">Ingredients</span><span class="ml-2">{formatList(displayBits, '–')}</span>
			</div>
			{#if activeField === 'bits'}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="max-w-xs pb-1" onclick={(e) => e.stopPropagation()}>
					<InputSelect
						items={allBits}
						selectedValues={editState?.bitIds ?? product.bits.map((b) => b.id)}
						onchange={onBitsChange}
						onfocusleave={() => onCloseEditorIfActive('bits')}
						multiSelect={true}
						color="green"
						allowCreate={true}
						onCreate={onCreateBit}
						placeholder="Search..."
						hidePills={true}
					/>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Processing -->
	<div data-row={rowIndex} data-col="processes" class="overflow-visible">
		{#if isPending || isFailed}
			<div class="py-1">
				<span class="italic text-muted-foreground">Processing</span><span class="ml-2">{product.processes.length > 0 ? product.processes.map((p) => titleCase(p.name)).join(', ') : '–'}</span>
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="w-fit cursor-pointer py-1"
				onclick={(e) => { e.stopPropagation(); if (activeField !== 'processes') onOpenEditor('processes'); }}
				data-focusable
				data-auto-open
			>
				<span class="italic text-muted-foreground">Processing</span><span class="ml-2">{formatList(displayProcesses, '–')}</span>
			</div>
			{#if activeField === 'processes'}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="max-w-xs pb-1" onclick={(e) => e.stopPropagation()}>
					<InputSelect
						items={allProcesses}
						selectedValues={editState?.processIds ?? product.processes.map((p) => p.id)}
						onchange={onProcessesChange}
						onfocusleave={() => onCloseEditorIfActive('processes')}
						multiSelect={true}
						color="blue"
						placeholder="Search..."
						hidePills={true}
					/>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Allergen Warnings -->
	<div data-row={rowIndex} data-col="allergens" class="overflow-visible">
		{#if isPending || isFailed}
			<div class="py-1">
				<span class="italic text-muted-foreground">Allergens</span><span class="ml-2">{product.allergenWarnings.length > 0 ? product.allergenWarnings.map((a) => titleCase(a.name.replace(/^May contain /i, ''))).join(', ') : '–'}</span>
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="w-fit cursor-pointer py-1"
				onclick={(e) => { e.stopPropagation(); if (activeField !== 'allergens') onOpenEditor('allergens'); }}
				data-focusable
				data-auto-open
			>
				<span class="italic text-muted-foreground">Allergens</span><span class="ml-2">{displayAllergens.length > 0 ? displayAllergens.map((a) => titleCase(a.label.replace(/^May contain /i, ''))).join(', ') : '–'}</span>
			</div>
			{#if activeField === 'allergens'}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="max-w-xs pb-1" onclick={(e) => e.stopPropagation()}>
					<InputSelect
						items={allAllergenWarnings}
						selectedValues={editState?.allergenIds ?? product.allergenWarnings.map((a) => a.id)}
						onchange={onAllergensChange}
						onfocusleave={() => onCloseEditorIfActive('allergens')}
						multiSelect={true}
						color="orange"
						displayName={(item) => item.label.replace(/^May contain /i, '')}
						placeholder="Search..."
						hidePills={true}
					/>
				</div>
			{/if}
		{/if}
	</div>
</div>
