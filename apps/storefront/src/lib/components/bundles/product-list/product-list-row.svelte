<script lang="ts">
	import { tick } from 'svelte';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Button } from '$lib/components/bits/button';
	import { Badge } from '$lib/components/bits/badge';
	import { Input } from '$lib/components/bits/input';
	import * as Table from '$lib/components/bits/table';
	import { InputSelect, type InputSelectItem } from '$lib/components/blocks/input-select';
	import type { SellerProduct } from '$lib/api/admin/products.remote';

	/** Accumulated changes for this row. */
	interface EditState {
		name?: string;
		unitType?: string;
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
		/** Unit type options for the InputSelect. */
		unitTypes,
		/** Whether this product is in a pending-create state. */
		isPending = false,
		/** Whether this product failed to create. */
		isFailed = false,
		/** Whether this row's checkbox is selected (for bulk operations). */
		selected = false,
		/** Whether to show the checkbox column. */
		showCheckbox = false,
		/** Callback when selection changes. */
		onselect,
		/** Callback to save accumulated edits. */
		onsave,
		/** Callback to delete this product. */
		ondelete,
		/** Callback to retry a failed create. */
		onretry,
		/** Callback to dismiss a failed create. */
		ondismiss,
		/** Callback to create a new bit (ingredient). */
		onCreateBit,
	}: {
		product: SellerProduct;
		rowIndex: number;
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		unitTypes: InputSelectItem[];
		isPending?: boolean;
		isFailed?: boolean;
		selected?: boolean;
		showCheckbox?: boolean;
		onselect?: (selected: boolean) => void;
		onsave: (productId: string, edits: {
			name?: string;
			unitType?: string;
			facetValueIds?: string[];
		}) => Promise<void>;
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
	let activeField: 'name' | 'unitType' | 'bits' | 'processes' | 'allergens' | null = $state(null);

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
		const unitTypeChanged =
			editState.unitType !== undefined && editState.unitType !== (product.unitType ?? '');
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
		return nameChanged || unitTypeChanged || bitsChanged || processChanged || allergensChanged;
	});

	// ─── Display values (edited or original) ───

	let displayName = $derived(editState?.name ?? product.name);
	let displayUnitType = $derived(editState?.unitType ?? product.unitType ?? '');
	let displayBitIds = $derived(editState?.bitIds ?? product.bits.map((b) => b.id));
	let displayProcessIds = $derived(editState?.processIds ?? product.processes.map((p) => p.id));
	let displayAllergenIds = $derived(
		editState?.allergenIds ?? product.allergenWarnings.map((a) => a.id)
	);

	/** Display bits resolved to full items. */
	let displayBits = $derived(allBits.filter((b) => displayBitIds.includes(b.value)));
	let displayProcesses = $derived(allProcesses.filter((p) => displayProcessIds.includes(p.value)));
	let displayAllergens = $derived(
		allAllergenWarnings.filter((a) => displayAllergenIds.includes(a.value))
	);

	// ─── Hover-to-focus ───

	/** Focus the first [data-focusable] child when pointer enters a cell. */
	function handleCellHover(e: PointerEvent) {
		const focusable = (e.currentTarget as HTMLElement).querySelector('[data-focusable]');
		(focusable as HTMLElement)?.focus();
	}

	// ─── Row focus-out cleanup ───

	/**
	 * When focus leaves this row and no actual changes were made,
	 * close the editor and clear edit state.
	 */
	function handleRowFocusOut(e: FocusEvent) {
		const row = e.currentTarget as HTMLElement;
		const focusLeavingRow = !e.relatedTarget || !row.contains(e.relatedTarget as Node);
		if (focusLeavingRow) {
			if (!isEditing) {
				activeField = null;
				editState = null;
			} else {
				activeField = null;
			}
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
				const row = document.querySelector(`[data-row="${rowIndex}"]`)?.closest('tr')
					?? document.querySelector(`tr:has([data-row="${rowIndex}"])`);
				const cell = row?.querySelector(`[data-col="${activeField}"]`);
				const focusable = cell?.querySelector('[data-focusable]') as HTMLElement | null;
				focusable?.focus();
			});
		}
	});

	// ─── Edit helpers ───

	type EditField = 'name' | 'unitType' | 'bits' | 'processes' | 'allergens';

	/** Initialize edit state if needed, then open a field editor. */
	function openEditor(field: EditField) {
		if (!editState) {
			editState = {};
		}
		const es = editState;
		activeField = field;

		// Initialize the field's edit value from product data if not already set
		if (field === 'name' && es.name === undefined) {
			es.name = product.name;
		} else if (field === 'unitType' && es.unitType === undefined) {
			es.unitType = product.unitType ?? '';
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
		const unitTypeChanged =
			editState.unitType !== undefined && editState.unitType !== (product.unitType ?? '');
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

		return nameChanged || unitTypeChanged || bitsChanged || processChanged || allergensChanged;
	}

	/** Close the active editor. Clear edit state if nothing changed. */
	function closeEditor() {
		activeField = null;
		if (!hasChanges()) {
			editState = null;
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
		const unitTypeChanged =
			editState.unitType !== undefined && editState.unitType !== (product.unitType ?? '');

		// Nothing actually changed — just close
		if (!nameChanged && !unitTypeChanged && !facetValueIds) {
			cancelEdits();
			return;
		}

		saving = true;
		activeField = null;

		try {
			await onsave(product.id, {
				...(nameChanged ? { name: editState.name } : {}),
				...(unitTypeChanged ? { unitType: editState.unitType } : {}),
				...(facetValueIds ? { facetValueIds } : {}),
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
	 * Handle unit type change from InputSelect.
	 * Opens editor and updates the edit state in one step.
	 */
	function handleUnitTypeChange(values: string[]) {
		if (!editState) editState = {};
		if (editState.unitType === undefined) {
			editState.unitType = product.unitType ?? '';
		}
		editState.unitType = values[0] ?? '';
	}
</script>

<Table.TableRow
	class={isPending
		? 'opacity-50'
		: isFailed
			? 'bg-destructive/5'
			: isEditing
				? ''
				: 'hover:bg-accent'}
	style={isEditing
		? 'background-color: light-dark(rgba(0,0,0,0.12), rgba(255,255,255,0.15))'
		: ''}
	onfocusout={handleRowFocusOut}
>
	<!-- Checkbox -->
	{#if showCheckbox}
		<Table.TableCell class="w-10 pr-0" data-row={rowIndex} data-col="checkbox" onpointerenter={handleCellHover}>
			{#if !isPending && !isFailed}
				<input
					type="checkbox"
					checked={selected}
					data-focusable
					onchange={(e) => {
						const checked = e.currentTarget.checked;
						onselect?.(checked);
						if (checked) cancelEdits();
					}}
					class="size-4 rounded border-input"
				/>
			{/if}
		</Table.TableCell>
	{/if}

	<!-- Product Name -->
	<Table.TableCell data-row={rowIndex} data-col="name" onpointerenter={handleCellHover}>
		{#if isPending}
			<span class="flex items-center gap-2">
				<SpinnerSun class="size-3.5 shrink-0 text-muted-foreground" />
				{product.name}
			</span>
		{:else if isFailed}
			<span class="text-destructive">{product.name}</span>
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
					if (e.key === 'Enter') { e.stopPropagation(); closeEditor(); }
					if (e.key === 'Escape') { e.stopPropagation(); cancelEdits(); }
				}}
				disabled={saving}
				class="h-7 text-sm"
			/>
		{:else}
			<button
				class="w-full cursor-text text-left hover:underline focus-visible:underline outline-none"
				data-focusable
				data-auto-open
				onclick={() => openEditor('name')}
			>
				{displayName}
			</button>
		{/if}
	</Table.TableCell>

	<!-- Bits -->
	<Table.TableCell class="overflow-visible" data-row={rowIndex} data-col="bits" onpointerenter={handleCellHover}>
		{#if isPending || isFailed}
			{#if product.bits.length > 0}
				<div class="flex flex-wrap gap-0.5">
					{#each product.bits as bit (bit.id)}
						<Badge
							variant="outline"
							class="border-green-600/30 bg-green-600/10 px-1.5 py-0 text-[11px] font-normal text-green-700 dark:text-green-300"
						>{bit.name}</Badge>
					{/each}
				</div>
			{:else}
				<span class="text-xs text-muted-foreground">—</span>
			{/if}
		{:else if activeField === 'bits'}
			<InputSelect
				items={allBits}
				selectedValues={editState?.bitIds ?? product.bits.map((b) => b.id)}
				onchange={(v) => {
					if (!editState) editState = {};
					editState.bitIds = v;
				}}
				multiSelect={true}
				color="green"
				allowCreate={true}
				onCreate={onCreateBit}
				placeholder="Search bits..."
				maxVisible={3}
			/>
		{:else}
			<button
				class="w-full cursor-pointer text-left outline-none"
				data-focusable
				data-auto-open
				onclick={() => openEditor('bits')}
			>
				{#if displayBits.length > 0}
					<div class="flex flex-wrap gap-0.5">
						{#each displayBits.slice(0, 4) as bit (bit.value)}
							<Badge
								variant="outline"
								class="border-green-600/30 bg-green-600/10 px-1.5 py-0 text-[11px] font-normal text-green-700 dark:text-green-300"
							>{bit.label}</Badge>
						{/each}
						{#if displayBits.length > 4}
							<Badge
								variant="outline"
								class="px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
							>+{displayBits.length - 4}</Badge>
						{/if}
					</div>
				{:else}
					<span class="text-xs text-muted-foreground hover:underline">—</span>
				{/if}
			</button>
		{/if}
	</Table.TableCell>

	<!-- Processing -->
	<Table.TableCell class="overflow-visible" data-row={rowIndex} data-col="processes" onpointerenter={handleCellHover}>
		{#if isPending || isFailed}
			{#if product.processes.length > 0}
				<div class="flex flex-wrap gap-0.5">
					{#each product.processes as proc (proc.id)}
						<Badge
							variant="outline"
							class="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[11px] font-normal text-blue-700 dark:text-blue-300"
						>{proc.name}</Badge>
					{/each}
				</div>
			{:else}
				<span class="text-xs text-muted-foreground">—</span>
			{/if}
		{:else if activeField === 'processes'}
			<InputSelect
				items={allProcesses}
				selectedValues={editState?.processIds ?? product.processes.map((p) => p.id)}
				onchange={(v) => {
					if (!editState) editState = {};
					editState.processIds = v;
				}}
				multiSelect={true}
				color="blue"
				placeholder="Search processing..."
			/>
		{:else}
			<button
				class="w-full cursor-pointer text-left outline-none"
				data-focusable
				data-auto-open
				onclick={() => openEditor('processes')}
			>
				{#if displayProcesses.length > 0}
					<div class="flex flex-wrap gap-0.5">
						{#each displayProcesses as proc (proc.value)}
							<Badge
								variant="outline"
								class="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[11px] font-normal text-blue-700 dark:text-blue-300"
							>{proc.label}</Badge>
						{/each}
					</div>
				{:else}
					<span class="text-xs text-muted-foreground">—</span>
				{/if}
			</button>
		{/if}
	</Table.TableCell>

	<!-- Allergen Warnings -->
	<Table.TableCell class="overflow-visible" data-row={rowIndex} data-col="allergens" onpointerenter={handleCellHover}>
		{#if isPending || isFailed}
			{#if product.allergenWarnings.length > 0}
				<div class="flex flex-wrap gap-0.5">
					{#each product.allergenWarnings as warning (warning.id)}
						<Badge
							variant="outline"
							class="border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[11px] font-normal text-orange-700 dark:text-orange-300"
						>{warning.name.replace(/^May contain /i, '')}</Badge>
					{/each}
				</div>
			{:else}
				<span class="text-xs text-muted-foreground">—</span>
			{/if}
		{:else if activeField === 'allergens'}
			<InputSelect
				items={allAllergenWarnings}
				selectedValues={editState?.allergenIds ?? product.allergenWarnings.map((a) => a.id)}
				onchange={(v) => {
					if (!editState) editState = {};
					editState.allergenIds = v;
				}}
				multiSelect={true}
				color="orange"
				displayName={(item) => item.label.replace(/^May contain /i, '')}
				placeholder="Search allergens..."
			/>
		{:else}
			<button
				class="w-full cursor-pointer text-left outline-none"
				data-focusable
				data-auto-open
				onclick={() => openEditor('allergens')}
			>
				{#if displayAllergens.length > 0}
					<div class="flex flex-wrap gap-0.5">
						{#each displayAllergens as warning (warning.value)}
							<Badge
								variant="outline"
								class="border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[11px] font-normal text-orange-700 dark:text-orange-300"
							>{warning.label.replace(/^May contain /i, '')}</Badge>
						{/each}
					</div>
				{:else}
					<span class="text-xs text-muted-foreground">—</span>
				{/if}
			</button>
		{/if}
	</Table.TableCell>

	<!-- Unit Type -->
	<Table.TableCell class="overflow-visible" data-row={rowIndex} data-col="unitType" onpointerenter={handleCellHover}>
		{#if isPending || isFailed}
			<span class="text-muted-foreground">
				{unitTypes.find((u) => u.value === product.unitType)?.label ?? '—'}
			</span>
		{:else}
			<InputSelect
				items={unitTypes}
				selectedValues={displayUnitType ? [displayUnitType] : []}
				onchange={handleUnitTypeChange}
				multiSelect={false}
				placeholder="Unit..."
			/>
		{/if}
	</Table.TableCell>

	<!-- Actions -->
	<Table.TableCell class="w-40 text-right" data-row={rowIndex} data-col="actions" onpointerenter={handleCellHover}>
		{#if isPending}
			<span class="text-xs text-muted-foreground">Saving...</span>
		{:else if isFailed}
			<div class="flex items-center justify-end gap-1">
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
			<div class="flex items-center justify-end gap-1">
				<Button
					size="sm"
					disabled={saving}
					data-focusable
					onclick={handleSave}
				>
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
			<div class="flex items-center justify-end gap-1">
				<Button
					size="sm"
					variant="destructive"
					disabled={deleting}
					data-focusable
					onclick={handleDelete}
				>
					{#if deleting}<SpinnerSun class="size-3.5" />{:else}Yes{/if}
				</Button>
				<Button size="sm" variant="ghost" data-focusable onclick={() => (confirmingDelete = false)}>
					No
				</Button>
			</div>
		{:else}
			<Button
				size="sm"
				variant="ghost"
				data-focusable
				onclick={() => (confirmingDelete = true)}
				class="text-destructive hover:text-destructive"
			>
				Delete
			</Button>
		{/if}
	</Table.TableCell>
</Table.TableRow>
