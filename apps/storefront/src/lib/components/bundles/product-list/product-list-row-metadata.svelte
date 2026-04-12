<script lang="ts">
	import { Badge } from '$lib/components/bits/badge';
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
</script>

<div class="space-y-2 overflow-visible px-3 pb-3 pt-1 md:px-4 md:pb-4">
	<!-- Bits / Ingredients -->
	<div data-row={rowIndex} data-col="bits" class="overflow-visible">
		<span class="text-xs font-medium text-muted-foreground">Ingredients</span>
		{#if isPending || isFailed}
			{#if product.bits.length > 0}
				<div class="mt-0.5 flex flex-wrap gap-0.5">
					{#each product.bits as bit (bit.id)}
						<Badge
							variant="outline"
							class="border-green-600/30 bg-green-600/10 px-1.5 py-0 text-[11px] font-normal text-green-700 dark:text-green-300"
							>{bit.name}</Badge
						>
					{/each}
				</div>
			{:else}
				<span class="ml-1 text-xs text-muted-foreground italic">raw</span>
			{/if}
		{:else if activeField === 'bits'}
			<div class="mt-0.5">
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
					maxVisible={3}
				/>
			</div>
		{:else}
			<button
				class="mt-0.5 w-full cursor-pointer text-left outline-none"
				data-focusable
				data-auto-open
				onclick={() => onOpenEditor('bits')}
			>
				{#if displayBits.length > 0}
					<div class="flex flex-wrap gap-0.5">
						{#each displayBits.slice(0, 4) as bit (bit.value)}
							<Badge
								variant="outline"
								class="border-green-600/30 bg-green-600/10 px-1.5 py-0 text-[11px] font-normal text-green-700 dark:text-green-300"
								>{bit.label}</Badge
							>
						{/each}
						{#if displayBits.length > 4}
							<Badge
								variant="outline"
								class="px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
								>+{displayBits.length - 4}</Badge
							>
						{/if}
					</div>
				{:else}
					<span class="text-xs text-muted-foreground italic">raw</span>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Processing -->
	<div data-row={rowIndex} data-col="processes" class="overflow-visible">
		<span class="text-xs font-medium text-muted-foreground">Processing</span>
		{#if isPending || isFailed}
			{#if product.processes.length > 0}
				<div class="mt-0.5 flex flex-wrap gap-0.5">
					{#each product.processes as proc (proc.id)}
						<Badge
							variant="outline"
							class="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[11px] font-normal text-blue-700 dark:text-blue-300"
							>{proc.name}</Badge
						>
					{/each}
				</div>
			{:else}
				<span class="ml-1 text-xs text-muted-foreground italic">fresh</span>
			{/if}
		{:else if activeField === 'processes'}
			<div class="mt-0.5">
				<InputSelect
					items={allProcesses}
					selectedValues={editState?.processIds ?? product.processes.map((p) => p.id)}
					onchange={onProcessesChange}
					onfocusleave={() => onCloseEditorIfActive('processes')}
					multiSelect={true}
					color="blue"
					placeholder="Search..."
				/>
			</div>
		{:else}
			<button
				class="mt-0.5 w-full cursor-pointer text-left outline-none"
				data-focusable
				data-auto-open
				onclick={() => onOpenEditor('processes')}
			>
				{#if displayProcesses.length > 0}
					<div class="flex flex-wrap gap-0.5">
						{#each displayProcesses as proc (proc.value)}
							<Badge
								variant="outline"
								class="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[11px] font-normal text-blue-700 dark:text-blue-300"
								>{proc.label}</Badge
							>
						{/each}
					</div>
				{:else}
					<span class="text-xs text-muted-foreground italic">fresh</span>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Allergen Warnings -->
	<div data-row={rowIndex} data-col="allergens" class="overflow-visible">
		<span class="text-xs font-medium text-muted-foreground">Allergens</span>
		{#if isPending || isFailed}
			{#if product.allergenWarnings.length > 0}
				<div class="mt-0.5 flex flex-wrap gap-0.5">
					{#each product.allergenWarnings as warning (warning.id)}
						<Badge
							variant="outline"
							class="border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[11px] font-normal text-orange-700 dark:text-orange-300"
							>{warning.name.replace(/^May contain /i, '')}</Badge
						>
					{/each}
				</div>
			{:else}
				<span class="ml-1 text-xs text-muted-foreground italic">none</span>
			{/if}
		{:else if activeField === 'allergens'}
			<div class="mt-0.5">
				<InputSelect
					items={allAllergenWarnings}
					selectedValues={editState?.allergenIds ?? product.allergenWarnings.map((a) => a.id)}
					onchange={onAllergensChange}
					onfocusleave={() => onCloseEditorIfActive('allergens')}
					multiSelect={true}
					color="orange"
					displayName={(item) => item.label.replace(/^May contain /i, '')}
					placeholder="Search..."
				/>
			</div>
		{:else}
			<button
				class="mt-0.5 w-full cursor-pointer text-left outline-none"
				data-focusable
				data-auto-open
				onclick={() => onOpenEditor('allergens')}
			>
				{#if displayAllergens.length > 0}
					<div class="flex flex-wrap gap-0.5">
						{#each displayAllergens as warning (warning.value)}
							<Badge
								variant="outline"
								class="border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[11px] font-normal text-orange-700 dark:text-orange-300"
								>{warning.label.replace(/^May contain /i, '')}</Badge
							>
						{/each}
					</div>
				{:else}
					<span class="text-xs text-muted-foreground italic">none</span>
				{/if}
			</button>
		{/if}
	</div>
</div>
