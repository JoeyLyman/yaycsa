<script lang="ts">
	import { tick } from 'svelte';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Button } from '$lib/components/bits/button';
	import { Input } from '$lib/components/bits/input';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import type { SellerProduct } from '$lib/api/admin/products.remote';
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
		/** Whether this product is in a pending-create state. */
		isPending = false,
		/** Whether this product failed to create. */
		isFailed = false,
		/** Global default for whether metadata tier is expanded. */
		globalMetadataDefault = false,
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
		isPending?: boolean;
		isFailed?: boolean;
		globalMetadataDefault?: boolean;
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

	// ─── Internal editing state ───

	/** Accumulated edits for this row. null when not editing. */
	let editState = $state<EditState | null>(null);

	/**
	 * Which field editor is currently open.
	 * null when no editor is active.
	 */
	let activeField: 'name' | 'bits' | 'processes' | 'allergens' | null = $state(null);

	/** Whether this row is currently saving edits. */
	let saving = $state(false);

	/** Whether this row is in delete-confirm mode. */
	let confirmingDelete = $state(false);

	/** Whether a delete is in flight. */
	let deleting = $state(false);

	/** Whether any field has been actually edited (has real changes from original values). */
	let isEditing = $derived.by(() => {
		if (!editState) return false;
		const nameChanged = editState.name !== undefined && editState.name !== product.name;
		const bitsChanged =
			editState.bitIds !== undefined &&
			JSON.stringify([...editState.bitIds].sort()) !==
				JSON.stringify(product.bits.map((b) => b.id).sort());
		const processChanged =
			editState.processIds !== undefined &&
			JSON.stringify([...editState.processIds].sort()) !==
				JSON.stringify(product.processes.map((p) => p.id).sort());
		const allergensChanged =
			editState.allergenIds !== undefined &&
			JSON.stringify([...editState.allergenIds].sort()) !==
				JSON.stringify(product.allergenWarnings.map((a) => a.id).sort());
		return nameChanged || bitsChanged || processChanged || allergensChanged;
	});

	// ─── Display values (edited or original) ───

	let displayName = $derived(editState?.name ?? product.name);

	/** Resolved bit items for the metadata summary. */
	let displayBits = $derived(
		allBits.filter((b) =>
			(editState?.bitIds ?? product.bits.map((b) => b.id)).includes(b.value)
		)
	);

	/** Resolved process items for the metadata summary. */
	let displayProcesses = $derived(
		allProcesses.filter((p) =>
			(editState?.processIds ?? product.processes.map((p) => p.id)).includes(p.value)
		)
	);

	/** Resolved allergen items for the metadata summary. */
	let displayAllergens = $derived(
		allAllergenWarnings.filter((a) =>
			(editState?.allergenIds ?? product.allergenWarnings.map((a) => a.id)).includes(a.value)
		)
	);

	// ─── Expand/collapse state ───

	/**
	 * Per-row metadata expand override.
	 * null = follow global default from parent.
	 * true/false = explicit user override for this row.
	 */
	let metadataExpanded: boolean | null = $state(null);

	/**
	 * Reset per-row override when the bulk toggle fires.
	 * Uses a closure variable (not $state) to track the previous global value.
	 */
	let prevGlobal: boolean | undefined;
	$effect(() => {
		const current = globalMetadataDefault;
		if (prevGlobal !== undefined && current !== prevGlobal) {
			metadataExpanded = null;
		}
		prevGlobal = current;
	});

	/** Whether tier 2 (metadata) is currently visible. Per-row override wins over global. */
	let showMetadata = $derived(metadataExpanded ?? globalMetadataDefault);

	/** Structured summary segments for the collapsed metadata line. */
	let metadataSummary = $derived(
		computeMetadataSummary(displayBits, displayProcesses, displayAllergens)
	);

	// ─── Row focus-out cleanup ───

	/**
	 * When focus leaves this row and no actual changes were made,
	 * close the editor and clear edit state.
	 *
	 * IMPORTANT: We must ignore focusout events where relatedTarget is null.
	 * When auto-open swaps a read-mode button for an editor input, the button
	 * is removed from DOM, which fires focusout with relatedTarget=null. Acting
	 * on this would clear activeField/editState and collapse the editor before
	 * it can mount. Do NOT use requestAnimationFrame to defer the check — it
	 * fights with Svelte's DOM update batching and breaks clicking entirely.
	 */
	function handleRowFocusOut(e: FocusEvent) {
		const related = e.relatedTarget as Node | null;
		if (!related) return;

		const row = e.currentTarget as HTMLElement;
		if (row.contains(related)) return;

		// Focus genuinely moved outside this row — dismiss delete confirm
		confirmingDelete = false;

		if (!isEditing) {
			activeField = null;
			editState = null;
		} else {
			activeField = null;
		}
	}

	// ─── Focus-on-edit effect ───

	/**
	 * When an editor opens (activeField changes from null to a field name),
	 * wait for the DOM to update then focus the new editor's input.
	 */
	$effect(() => {
		if (activeField !== null) {
			tick().then(() => {
				const row =
					document
						.querySelector(`[data-row="${rowIndex}"]`)
						?.closest('[data-product-row]') ??
					document.querySelector(`[data-product-row]:has([data-row="${rowIndex}"])`);
				const cell = row?.querySelector(`[data-col="${activeField}"]`);
				const focusable = cell?.querySelector('[data-focusable]') as HTMLElement | null;
				focusable?.focus();
			});
		}
	});

	// ─── Edit helpers ───

	type EditField = 'name' | 'bits' | 'processes' | 'allergens';

	/** Initialize edit state if needed, then open a field editor. */
	function openEditor(field: EditField) {
		if (!editState) {
			editState = {};
		}
		const es = editState;
		activeField = field;

		// Auto-expand metadata tier when editing a metadata field
		if (field === 'bits' || field === 'processes' || field === 'allergens') {
			metadataExpanded = true;
		}

		// Initialize the field's edit value from product data if not already set
		if (field === 'name' && es.name === undefined) {
			es.name = product.name;
		} else if (field === 'bits' && es.bitIds === undefined) {
			es.bitIds = product.bits.map((b) => b.id);
		} else if (field === 'processes' && es.processIds === undefined) {
			es.processIds = product.processes.map((p) => p.id);
		} else if (field === 'allergens' && es.allergenIds === undefined) {
			es.allergenIds = product.allergenWarnings.map((a) => a.id);
		}
	}

	/**
	 * Check whether the edit state has any actual changes vs. the product data.
	 * Returns true if there are real changes.
	 */
	function hasChanges(): boolean {
		if (!editState) return false;

		const nameChanged = editState.name !== undefined && editState.name !== product.name;
		const bitsChanged =
			editState.bitIds !== undefined &&
			JSON.stringify([...editState.bitIds].sort()) !==
				JSON.stringify(product.bits.map((b) => b.id).sort());
		const processChanged =
			editState.processIds !== undefined &&
			JSON.stringify([...editState.processIds].sort()) !==
				JSON.stringify(product.processes.map((p) => p.id).sort());
		const allergensChanged =
			editState.allergenIds !== undefined &&
			JSON.stringify([...editState.allergenIds].sort()) !==
				JSON.stringify(product.allergenWarnings.map((a) => a.id).sort());

		return nameChanged || bitsChanged || processChanged || allergensChanged;
	}

	/** Close the active editor. Clear edit state if nothing changed. */
	function closeEditor() {
		activeField = null;
		if (!hasChanges()) {
			editState = null;
		}
	}

	/**
	 * Close a specific cell editor when focus leaves that InputSelect entirely.
	 * This keeps the UI spreadsheet-like: once focus leaves the cell, the
	 * transient editor UI should disappear and fall back to read mode.
	 */
	function closeEditorIfActive(field: EditField) {
		if (activeField === field) {
			closeEditor();
		}
	}

	/** Discard all pending edits for this row. */
	function cancelEdits() {
		editState = null;
		activeField = null;
	}

	/** Save all accumulated edits. */
	async function handleSave() {
		if (!editState) return;

		const bitsChanged = editState.bitIds !== undefined;
		const processChanged = editState.processIds !== undefined;
		const allergensChanged = editState.allergenIds !== undefined;

		// Build facetValueIds (full replacement set) if any facet was edited
		let facetValueIds: string[] | undefined;
		if (bitsChanged || processChanged || allergensChanged) {
			const bitIds = editState.bitIds ?? product.bits.map((b) => b.id);
			const processIds = editState.processIds ?? product.processes.map((p) => p.id);
			const allergenIds = editState.allergenIds ?? product.allergenWarnings.map((a) => a.id);
			facetValueIds = [...bitIds, ...processIds, ...allergenIds];
		}

		const nameChanged = editState.name !== undefined && editState.name !== product.name;

		// Nothing actually changed — just close
		if (!nameChanged && !facetValueIds) {
			cancelEdits();
			return;
		}

		saving = true;
		activeField = null;

		try {
			await onsave(product.id, {
				...(nameChanged ? { name: editState.name } : {}),
				...(facetValueIds ? { facetValueIds } : {})
			});
			editState = null;
		} catch (err) {
			console.error('Failed to save product:', err);
			// Keep edits on error so user can retry
		}

		saving = false;
	}

	/** Handle delete with confirmation. */
	async function handleDelete() {
		deleting = true;
		try {
			await ondelete(product.id);
		} catch (err) {
			console.error('Failed to delete product:', err);
		}
		deleting = false;
		confirmingDelete = false;
	}

	/**
	 * Handle click on the row area (tier 1, summary, or expanded tier 2).
	 * Toggles expand/collapse unless the click landed on an interactive element.
	 */
	function handleRowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// Don't toggle if clicking directly on a button or input
		if (
			target.closest('button') ||
			target.closest('input')
		) {
			return;
		}
		// Close any open editor when expanding/collapsing
		activeField = null;
		metadataExpanded = !showMetadata;
	}
</script>

<!-- Row container: uses data-product-row for focusout and focus-on-edit. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	data-product-row
	data-row={rowIndex}
	class="cursor-pointer border-b {isPending
		? 'opacity-50'
		: isFailed
			? 'bg-destructive/5'
			: ''}"
	onfocusout={handleRowFocusOut}
	onclick={handleRowClick}
>
	<!-- ═══ Tier 1: Product name, actions (always visible) ═══ -->
	<div class="flex min-h-11 items-center gap-2 px-3 py-1 md:gap-3 md:px-4 md:py-1.5">
		<!-- Product Name — sized to content, not full width, so empty row space is clickable for expand -->
		<div class="min-w-0 shrink truncate" data-col="name">
			{#if isPending}
				<span class="flex items-center gap-2">
					<SpinnerSun class="size-3.5 shrink-0 text-muted-foreground" />
					<span class="truncate">{product.name}</span>
				</span>
			{:else if isFailed}
				<span class="truncate text-destructive">{product.name}</span>
			{:else if activeField === 'name'}
				<Input
					value={editState?.name ?? product.name}
					data-focusable
					oninput={(e) => {
						if (!editState) editState = {};
						editState.name = e.currentTarget.value;
					}}
					onblur={closeEditor}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.stopPropagation();
							closeEditor();
						}
						if (e.key === 'Escape') {
							e.stopPropagation();
							cancelEdits();
						}
					}}
					disabled={saving}
					class="h-7 text-sm"
				/>
			{:else}
				<button
					class="-ml-1 cursor-text truncate rounded px-1 py-0.5 text-left outline-none hover:underline focus-visible:underline"
					data-focusable
					data-auto-open
					onclick={() => openEditor('name')}
				>
					{displayName}
				</button>
			{/if}
		</div>

		<!-- Spacer — clickable gap between name and actions, triggers expand/collapse -->
		<div class="flex-1"></div>

		<!-- Actions -->
		<div class="shrink-0" data-col="actions">
			{#if isPending}
				<span class="text-xs text-muted-foreground">Saving...</span>
			{:else if isFailed}
				<div class="flex items-center gap-1">
					<Button
						size="sm"
						variant="ghost"
						data-focusable
						onclick={() => onretry(product.id)}
						class="text-xs"
					>
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
					<Button size="sm" disabled={saving} data-focusable onclick={handleSave}>
						{#if saving}
							<SpinnerSun class="size-3.5" />
						{:else}
							Save
						{/if}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={saving}
						data-focusable
						onclick={cancelEdits}
					>
						Cancel
					</Button>
				</div>
			{:else if confirmingDelete}
				<!-- Delete confirmation — inline, same style as Save/Cancel -->
				<div class="flex items-center gap-1">
					<Button
						size="sm"
						variant="destructive"
						disabled={deleting}
						data-focusable
						onclick={handleDelete}
					>
						{#if deleting}<SpinnerSun class="size-3.5" />{:else}Delete{/if}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						data-focusable
						onclick={() => (confirmingDelete = false)}
					>
						Cancel
					</Button>
				</div>
			{:else}
				<!-- Ellipsis button — opens inline delete/cancel -->
				<button
					class="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
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

	<!-- Metadata summary line (visible when tier 2 is collapsed, hidden for pending/failed) -->
	{#if !showMetadata && !isPending && !isFailed}
		<div class="-mt-1 truncate px-3 pb-3 text-xs text-muted-foreground md:px-4">
			{#each metadataSummary as segment}{#if segment.italic}<span class="{segment.section ? 'ml-4' : ''} italic">{segment.text}</span>{:else}<span class="{segment.spaced ? 'ml-2' : ''} text-foreground">{segment.text}</span>{/if}{/each}
		</div>
	{/if}

	<!-- ═══ Tier 2: Metadata — bits, processing, allergens (collapsible) ═══ -->
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
			{saving}
			onOpenEditor={openEditor}
			onCloseEditorIfActive={closeEditorIfActive}
			onBitsChange={(v: string[]) => {
				if (!editState) editState = {};
				editState.bitIds = v;
			}}
			onProcessesChange={(v: string[]) => {
				if (!editState) editState = {};
				editState.processIds = v;
			}}
			onAllergensChange={(v: string[]) => {
				if (!editState) editState = {};
				editState.allergenIds = v;
			}}
			{onCreateBit}
		/>
	{/if}
</div>
