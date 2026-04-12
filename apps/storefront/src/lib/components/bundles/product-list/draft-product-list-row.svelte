<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Button } from '$lib/components/bits/button';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import { ProductListRowFieldsName } from '$lib/components/blocks/product-list-row-fields';
	import { hasDuplicateProductName } from '$lib/utils/product-name.js';
	import { nextProductMetadataMode } from './product-list-metadata-mode';
	import type { ProductDraft, ProductDraftPatch, ProductMetadataMode } from './product-list-types';
	import { computeMetadataSummary } from './product-list-row-metadata-summary';
	import DraftProductListRowMetadata from './draft-product-list-row-metadata.svelte';

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
		/** Global default metadata visibility mode for the whole product table. */
		globalMetadataMode = 'summary',
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
		globalMetadataMode?: ProductMetadataMode;
		onsave: (draftId: string) => void | Promise<void>;
		oncancel: (draftId: string) => void;
		onupdate: (draftId: string, patch: ProductDraftPatch) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	/** Reference to the draft name input so a newly added row can autofocus it. */
	let nameInputEl: HTMLInputElement | null = $state(null);

	/** Which draft field editor is currently open. */
	let activeField: 'name' | 'bits' | 'processes' | 'allergens' | null = $state('name');

	/**
	 * Per-row metadata mode override for this draft row.
	 * New draft rows start expanded so sellers can immediately fill metadata, but
	 * they can cycle through summary and hidden modes just like saved rows.
	 * Null means "follow the current global metadata mode".
	 */
	let metadataModeOverride: ProductMetadataMode | null = $state('expanded');

	/**
	 * Trimmed draft name used for Save-button gating.
	 * This ignores accidental leading/trailing spaces while the seller types.
	 */
	let trimmedDraftName = $derived(draftProduct.name.trim());

	/** Whether this draft row currently has a non-empty display name. */
	let hasDraftName = $derived(trimmedDraftName.length > 0);

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

	/** Resolved bit items currently selected on this draft row. */
	let displayBits = $derived(allBits.filter((bit) => draftProduct.bitIds.includes(bit.value)));

	/** Resolved processing items currently selected on this draft row. */
	let displayProcesses = $derived(
		allProcesses.filter((processItem) => draftProduct.processIds.includes(processItem.value))
	);

	/** Resolved allergen warning items currently selected on this draft row. */
	let displayAllergens = $derived(
		allAllergenWarnings.filter((allergen) => draftProduct.allergenIds.includes(allergen.value))
	);

	/** Structured summary segments for the collapsed metadata line. */
	let metadataSummary = $derived(
		computeMetadataSummary(displayBits, displayProcesses, displayAllergens)
	);

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

	/** Effective metadata mode after combining the global mode with any draft-row override. */
	let effectiveMetadataMode = $derived(
		(metadataModeOverride ?? globalMetadataMode) as ProductMetadataMode
	);

	/** Whether the metadata tier is currently visible for this draft row. */
	let showMetadata = $derived(effectiveMetadataMode === 'expanded');

	/** Whether the collapsed metadata summary line should be visible for this draft row. */
	let showMetadataSummary = $derived(effectiveMetadataMode === 'summary');

	/**
	 * Whether this draft row is currently rendering any secondary metadata content below tier 1.
	 * When false, the top row needs extra bottom padding so the name/button block has
	 * symmetrical breathing room even with metadata fully hidden.
	 */
	let hasMetadataBelow = $derived(showMetadata || showMetadataSummary);

	/**
	 * Whether the Save button should be enabled for this draft row.
	 * A draft can save only when the name is long enough and not duplicated.
	 */
	let canSaveDraft = $derived(hasMinimumDraftNameLength && !nameError);

	$effect(() => {
		if (activeField === 'name') {
			tick().then(() => {
				nameInputEl?.focus();
			});
		}
	});

	onMount(async () => {
		await tick();
		nameInputEl?.focus();
	});

	/** Close transient draft editors when focus fully leaves this row. */
	function handleRowFocusOut(event: FocusEvent) {
		const relatedTarget = event.relatedTarget as Node | null;
		if (!relatedTarget) return;

		const rowElement = event.currentTarget as HTMLElement;
		if (rowElement.contains(relatedTarget)) return;

		activeField = null;
	}

	/** Open one draft editor and ensure the other draft editors are closed. */
	function openEditor(field: 'name' | 'bits' | 'processes' | 'allergens') {
		activeField = field;
		if (field === 'bits' || field === 'processes' || field === 'allergens') {
			metadataModeOverride = 'expanded';
		}
	}

	/** Close the name editor and fall back to the saved-row-style text button. */
	function closeNameEditor() {
		if (activeField === 'name') {
			activeField = null;
		}
	}

	/** Close a specific metadata editor when its input-select fully loses focus. */
	function closeEditorIfActive(field: 'bits' | 'processes' | 'allergens') {
		if (activeField === field) {
			activeField = null;
		}
	}

	/**
	 * Toggle the metadata section when the non-interactive part of the draft row is clicked.
	 * Buttons and inputs keep their own behavior and never trigger row collapse.
	 */
	function handleRowClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.closest('button') || target.closest('input')) {
			return;
		}
		activeField = null;
		metadataModeOverride = nextProductMetadataMode(effectiveMetadataMode);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	data-product-row
	data-row={rowIndex}
	class="cursor-pointer border-b last:border-b-0"
	onfocusout={handleRowFocusOut}
	onclick={handleRowClick}
>
	<div class="flex min-h-11 items-start gap-2 px-3 pt-[8px] {hasMetadataBelow ? 'pb-1' : 'pb-[8px]'} md:gap-3 md:px-4 md:pt-[10px] {hasMetadataBelow ? 'md:pb-1.5' : 'md:pb-[10px]'}">
		<div class="min-w-0 flex-1" data-col="name">
			{#if activeField === 'name'}
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
					onblur={closeNameEditor}
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
			{:else}
				<button
					class="-ml-1 inline-flex min-h-8 items-center cursor-text truncate rounded px-1 py-0.5 text-left text-[17px] font-medium leading-tight outline-none hover:underline focus-visible:underline"
					data-focusable
					data-auto-open
					onclick={() => openEditor('name')}
				>
					{#if hasDraftName}
						{trimmedDraftName}
					{:else}
						<span class="text-muted-foreground">Product name</span>
					{/if}
				</button>

				{#if nameError}
					<p class="mt-0.5 text-xs text-destructive">{nameError}</p>
				{/if}
			{/if}
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
		<DraftProductListRowMetadata
			{draftProduct}
			{rowIndex}
			{allBits}
			{allProcesses}
			{allAllergenWarnings}
			activeField={activeField === 'name' ? null : activeField}
			onOpenEditor={(field) => openEditor(field)}
			onCloseEditorIfActive={closeEditorIfActive}
			onBitsChange={(bitIds: string[]) => onupdate(draftProduct.id, { bitIds })}
			onProcessesChange={(processIds: string[]) => onupdate(draftProduct.id, { processIds })}
			onAllergensChange={(allergenIds: string[]) => onupdate(draftProduct.id, { allergenIds })}
			{onCreateBit}
		/>
	{/if}
</div>
