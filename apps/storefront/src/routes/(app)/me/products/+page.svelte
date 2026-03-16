<script lang="ts">
	import {
		myProducts,
		createProduct,
		updateProduct,
		deleteProduct,
		createBit,
		fetchBits,
		fetchProcessTypes,
		fetchAllergenWarnings,
		type SellerProduct,
		type FacetValueInfo
	} from '$lib/api/admin/products.remote';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Button } from '$lib/components/bits/button';
	import { Badge } from '$lib/components/bits/badge';
	import { Input } from '$lib/components/bits/input';
	import * as Table from '$lib/components/bits/table';

	/** All available unit type options. */
	const UNIT_TYPES = [
		{ value: '', label: 'None' },
		{ value: 'ct', label: 'Count (ct)' },
		{ value: 'lb', label: 'Pound (lb)' },
		{ value: 'oz', label: 'Ounce (oz)' },
		{ value: 'kg', label: 'Kilogram (kg)' },
		{ value: 'g', label: 'Gram (g)' },
		{ value: 'pt', label: 'Pint (pt)' },
		{ value: 'qt', label: 'Quart (qt)' },
		{ value: 'gal', label: 'Gallon (gal)' },
		{ value: 'cs', label: 'Case (cs)' },
		{ value: 'bu', label: 'Bushel (bu)' }
	] as const;

	/**
	 * Local mutable copy of products.
	 * Updated optimistically on create/update/delete.
	 */
	let products: SellerProduct[] = $state([]);

	/** Whether the initial data is still loading. */
	let loading = $state(true);

	/** Error from initial load or reload. */
	let loadError: string | null = $state(null);

	// ─── Taxonomy data (fetched once, shared across form + editing) ───

	/** All available bits (ingredients/components) from the bits facet. */
	let allBits: FacetValueInfo[] = $state([]);

	/** All available processing types from the process facet. */
	let allProcesses: FacetValueInfo[] = $state([]);

	/** All available allergen warnings from the allergen-warning facet. */
	let allAllergenWarnings: FacetValueInfo[] = $state([]);

	// ─── Add product form state ───

	/** Name input for the add-product row. */
	let newName = $state('');

	/** SKU input for the add-product row (optional — auto-generated if blank). */
	let newSku = $state('');

	/** Unit type selection for the add-product row. */
	let newUnitType = $state('');

	/** Selected bit (ingredient) FacetValue IDs for the new product. */
	let newBitIds: string[] = $state([]);

	/** Selected process FacetValue IDs for the new product. */
	let newProcessIds: string[] = $state([]);

	/** Selected allergen warning FacetValue IDs for the new product. */
	let newAllergenIds: string[] = $state([]);

	/** Search filter for the bits typeahead in the create form. */
	let bitsSearch = $state('');

	/**
	 * Whether the bits dropdown is open in the create form.
	 * Toggled by clicking the search input, closed by clicking outside.
	 */
	let bitsDropdownOpen = $state(false);

	/** Whether a new bit is currently being created via the Admin API. */
	let creatingBit = $state(false);

	/** Whether the unit type dropdown is open in the create form. */
	let unitTypeDropdownOpen = $state(false);

	/** Reference to the unit type dropdown container for click-outside detection. */
	let unitTypeContainerEl: HTMLDivElement | null = $state(null);

	/**
	 * Reference to the bits dropdown container for click-outside detection.
	 * When a click occurs outside this element, the dropdown closes.
	 */
	let bitsContainerEl: HTMLDivElement | null = $state(null);

	/** Reference to the create form's bits search input for re-focusing after selection. */
	let bitsSearchInput: HTMLInputElement | null = $state(null);

	/** Counter for generating unique temporary IDs for optimistic inserts. */
	let tempIdCounter = 0;

	/**
	 * Set of temporary IDs for products that are currently being created on the server.
	 * Products with these IDs show an inline loading state in the table.
	 */
	let pendingIds: Set<string> = $state(new Set());

	/**
	 * Map of temporary IDs to error messages for products that failed to create.
	 * Products with these IDs show an inline error state with a retry option.
	 */
	let failedIds: Map<string, string> = $state(new Map());

	// ─── Inline editing state ───
	// Multiple rows can have pending edits simultaneously.
	// Only one field editor (input/dropdown) is open at a time.

	/** Accumulated changes per product. Key = product ID. */
	interface EditState {
		name?: string;
		unitType?: string;
		bitIds?: string[];
		processIds?: string[];
		allergenIds?: string[];
	}

	/**
	 * Map of product ID → pending edits for that row.
	 * Rows in this map show Save/Cancel and a highlight background.
	 */
	let edits: Record<string, EditState> = $state({});

	/**
	 * Which field editor is currently open (only one at a time).
	 * null when no input/dropdown is visible.
	 */
	let activeEditor: { id: string; field: 'name' | 'sku' | 'unitType' | 'bits' | 'processes' | 'allergens' } | null = $state(null);

	/** Search filter for the bits typeahead when editing an existing product's bits. */
	let editBitsSearch = $state('');

	/** Reference to the edit bits search input for re-focusing after selection. */
	let editBitsInput: HTMLInputElement | null = $state(null);

	/**
	 * Map of product ID → true for rows currently being saved.
	 * Uses a $state record instead of SvelteSet because SvelteSet.has()
	 * doesn't reliably trigger re-renders inside {#each} blocks.
	 */
	let saving: Record<string, boolean> = $state({});

	/**
	 * Reference to the edit facet dropdown container for click-outside detection.
	 * Bound to whichever facet dropdown is currently open.
	 */
	let editFacetContainerEl: HTMLDivElement | null = $state(null);

	/** Update the edit state for a product (immutable — triggers reactivity). */
	function updateEditState(productId: string, patch: Partial<EditState>) {
		const current = edits[productId] ?? {};
		edits[productId] = { ...current, ...patch };
	}

	// ─── Delete state ───

	/** Product ID pending delete confirmation. */
	let confirmDeleteId: string | null = $state(null);

	/** Whether a delete is in flight. */
	let deleting = $state(false);

	// ─── Derived: filtered bits for the typeahead dropdown ───

	/**
	 * Bits filtered by the search query, grouped by food group.
	 * Only shown in the create form dropdown.
	 */
	let filteredBits = $derived.by(() => {
		const q = bitsSearch.toLowerCase().trim();
		const filtered = q
			? allBits.filter((b) => b.name.toLowerCase().includes(q) || (b.group ?? '').toLowerCase().includes(q))
			: allBits;
		return filtered.slice(0, 50); // cap at 50 results for performance
	});

	/**
	 * Normalize a bit name to Title Case, letters/numbers/spaces/ampersands only.
	 * Mirrors the server-side normalization so the preview matches what gets created.
	 */
	function normalizeBitName(raw: string): string {
		return raw
			.replace(/[^a-zA-Z0-9\s&]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * The normalized version of the current search term, ready for display in
	 * the "Create" button. Empty string when the search is too short.
	 */
	let normalizedBitName = $derived(bitsSearch.trim().length >= 2 ? normalizeBitName(bitsSearch) : '');

	/**
	 * Whether the current search term can be created as a new bit.
	 * True when the normalized name has no exact match in allBits.
	 */
	let canCreateBit = $derived.by(() => {
		if (!normalizedBitName) return false;
		return !allBits.some((b) => b.name.toLowerCase() === normalizedBitName.toLowerCase());
	});

	// ─── Derived: filtered bits for the edit dropdown ───

	/**
	 * Bits filtered by the edit search query.
	 * Only shown when editing an existing product's bits column.
	 */
	let filteredEditBits = $derived.by(() => {
		const q = editBitsSearch.toLowerCase().trim();
		const filtered = q
			? allBits.filter((b) => b.name.toLowerCase().includes(q) || (b.group ?? '').toLowerCase().includes(q))
			: allBits;
		return filtered.slice(0, 50);
	});

	// ─── Click-outside handlers for dropdowns ───

	function handleClickOutside(event: MouseEvent) {
		if (bitsContainerEl && !bitsContainerEl.contains(event.target as Node)) {
			bitsDropdownOpen = false;
		}
	}

	/** Close the active facet dropdown when clicking outside it; discard edits if unchanged. */
	function handleEditFacetClickOutside(event: MouseEvent) {
		if (editFacetContainerEl && !editFacetContainerEl.contains(event.target as Node)) {
			const id = activeEditor?.id;
			activeEditor = null;
			if (id) clearIfUnchanged(id);
		}
	}

	/** Close the unit type dropdown in the create form when clicking outside it. */
	function handleUnitTypeClickOutside(event: MouseEvent) {
		if (unitTypeContainerEl && !unitTypeContainerEl.contains(event.target as Node)) {
			unitTypeDropdownOpen = false;
		}
	}

	$effect(() => {
		if (bitsDropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	});

	$effect(() => {
		if (unitTypeDropdownOpen) {
			document.addEventListener('mousedown', handleUnitTypeClickOutside);
			return () => document.removeEventListener('mousedown', handleUnitTypeClickOutside);
		}
	});

	$effect(() => {
		if (activeEditor && ['bits', 'processes', 'allergens', 'unitType'].includes(activeEditor.field)) {
			document.addEventListener('mousedown', handleEditFacetClickOutside);
			return () => document.removeEventListener('mousedown', handleEditFacetClickOutside);
		}
	});

	// ─── Create custom bit ───

	/**
	 * Create a new bit (ingredient) from the current search term.
	 * Calls the Admin API, adds to local state, and selects it.
	 */
	async function handleCreateBit() {
		const name = bitsSearch.trim();
		if (name.length < 2) return;

		creatingBit = true;
		try {
			const newBit = await createBit({ name });
			// Add to local taxonomy cache (skip if already present — server-side dedup)
			if (!allBits.some((b) => b.id === newBit.id)) {
				allBits = [...allBits, newBit];
			}
			if (!newBitIds.includes(newBit.id)) {
				newBitIds = [...newBitIds, newBit.id];
			}
			bitsSearch = '';
		} catch (err) {
			console.error('Failed to create bit:', err);
		}
		creatingBit = false;
	}

	// ─── Initial data load (runs once on mount) ───

	loadAll();

	async function loadAll() {
		loading = true;
		loadError = null;
		try {
			const [prods, bits, procs, allergens] = await Promise.all([
				myProducts(),
				fetchBits(),
				fetchProcessTypes(),
				fetchAllergenWarnings(),
			]);
			products = prods;
			allBits = bits;
			allProcesses = procs.sort((a, b) => a.name.localeCompare(b.name));
			allAllergenWarnings = allergens.sort((a, b) => a.name.localeCompare(b.name));

			// Default-select "Raw / Fresh" for new products
			const rawProcess = procs.find((p) => p.code === 'raw');
			if (rawProcess) {
				newProcessIds = [rawProcess.id];
			}
		} catch (err) {
			loadError =
				err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
			console.error('Failed to load products:', err);
		}
		loading = false;
	}

	// ─── Actions ───

	/** Reference to the product name input for re-focusing after submit. */
	let nameInput: HTMLInputElement | null = $state(null);

	async function handleCreate() {
		const name = newName.trim();
		if (!name) return;

		const sku = newSku.trim() || undefined;
		const unitType = newUnitType || undefined;
		const facetValueIds = [...newBitIds, ...newProcessIds, ...newAllergenIds];

		// Generate a temporary ID and optimistically insert into the table
		const tempId = `__pending_${++tempIdCounter}`;
		const optimisticProduct: SellerProduct = {
			id: tempId,
			name,
			variantId: '',
			sku: sku ?? name.toUpperCase().replace(/\s+/g, '-'),
			unitType: unitType ?? null,
			bits: allBits.filter((b) => newBitIds.includes(b.id)),
			processes: allProcesses.filter((p) => newProcessIds.includes(p.id)),
			allergenWarnings: allAllergenWarnings.filter((a) => newAllergenIds.includes(a.id)),
		};

		products = [...products, optimisticProduct];
		pendingIds = new Set([...pendingIds, tempId]);

		// Clear form immediately so the user can keep adding
		newName = '';
		newSku = '';
		newUnitType = '';
		newBitIds = [];
		// Re-default to "Raw / Fresh"
		const rawProcess = allProcesses.find((p) => p.code === 'raw');
		newProcessIds = rawProcess ? [rawProcess.id] : [];
		newAllergenIds = [];
		bitsSearch = '';
		nameInput?.focus();

		try {
			const created = await createProduct({
				name,
				sku,
				unitType,
				facetValueIds: facetValueIds.length ? facetValueIds : undefined,
			});

			// Replace the optimistic placeholder with the real server data
			products = products.map((p) => (p.id === tempId ? created : p));
			pendingIds = new Set([...pendingIds].filter((id) => id !== tempId));
		} catch (err) {
			console.error('Failed to create product:', err);
			pendingIds = new Set([...pendingIds].filter((id) => id !== tempId));
			failedIds = new Map([...failedIds, [tempId, 'Failed to create']]);
		}
	}

	/**
	 * Retry creating a product that previously failed.
	 * Removes the failed state, re-inserts as pending, and tries again.
	 */
	async function retryCreate(tempId: string) {
		const product = products.find((p) => p.id === tempId);
		if (!product) return;

		failedIds = new Map([...failedIds].filter(([id]) => id !== tempId));
		pendingIds = new Set([...pendingIds, tempId]);

		const facetValueIds = [
			...product.bits.map((b) => b.id),
			...product.processes.map((p) => p.id),
			...product.allergenWarnings.map((a) => a.id),
		];

		try {
			const created = await createProduct({
				name: product.name,
				sku: product.sku || undefined,
				unitType: product.unitType || undefined,
				facetValueIds: facetValueIds.length ? facetValueIds : undefined,
			});
			products = products.map((p) => (p.id === tempId ? created : p));
			pendingIds = new Set([...pendingIds].filter((id) => id !== tempId));
		} catch (err) {
			console.error('Failed to create product (retry):', err);
			pendingIds = new Set([...pendingIds].filter((id) => id !== tempId));
			failedIds = new Map([...failedIds, [tempId, 'Failed to create']]);
		}
	}

	/**
	 * Dismiss a failed optimistic insert, removing it from the table entirely.
	 */
	function dismissFailed(tempId: string) {
		products = products.filter((p) => p.id !== tempId);
		failedIds = new Map([...failedIds].filter(([id]) => id !== tempId));
	}

	type EditField = 'name' | 'sku' | 'unitType' | 'bits' | 'processes' | 'allergens';

	/**
	 * Open an editor for a specific field on a product.
	 * Initializes the field's value from product data if not already set.
	 * Multiple rows can have pending edits simultaneously.
	 */
	function openEditor(product: SellerProduct, field: EditField) {
		const state = edits[product.id] ?? {};
		activeEditor = { id: product.id, field };

		// Initialize the field's edit value from product data if not already set
		if (field === 'name' && state.name === undefined) {
			updateEditState(product.id, { name: product.name });
		} else if (field === 'unitType' && state.unitType === undefined) {
			updateEditState(product.id, { unitType: product.unitType ?? '' });
		} else if (field === 'bits') {
			if (state.bitIds === undefined) updateEditState(product.id, { bitIds: product.bits.map((b) => b.id) });
			editBitsSearch = '';
		} else if (field === 'processes') {
			if (state.processIds === undefined) updateEditState(product.id, { processIds: product.processes.map((p) => p.id) });
		} else if (field === 'allergens') {
			if (state.allergenIds === undefined) updateEditState(product.id, { allergenIds: product.allergenWarnings.map((a) => a.id) });
		}
	}

	/**
	 * Save ALL accumulated edits for a specific product row.
	 * Sends a single updateProduct call with every changed field.
	 */
	async function saveRow(productId: string) {
		// Snapshot the edit state before any async work (avoid proxy staleness)
		const rawEdits = edits[productId];
		const state = rawEdits ? { ...rawEdits } : undefined;
		const product = products.find((p) => p.id === productId);
		if (!state || !product) return;

		const bitsChanged = state.bitIds !== undefined;
		const processChanged = state.processIds !== undefined;
		const allergensChanged = state.allergenIds !== undefined;

		// Build the facetValueIds (full replacement set) if any facet was edited
		let facetValueIds: string[] | undefined;
		if (bitsChanged || processChanged || allergensChanged) {
			const bitIds = state.bitIds ?? product.bits.map((b) => b.id);
			const processIds = state.processIds ?? product.processes.map((p) => p.id);
			const allergenIds = state.allergenIds ?? product.allergenWarnings.map((a) => a.id);
			facetValueIds = [...bitIds, ...processIds, ...allergenIds];
		}

		const nameChanged = state.name !== undefined && state.name !== product.name;
		const unitTypeChanged = state.unitType !== undefined && state.unitType !== (product.unitType ?? '');

		// Nothing actually changed — just close
		if (!nameChanged && !unitTypeChanged && !facetValueIds) {
			cancelRow(productId);
			return;
		}

		saving[productId] = true;
		if (activeEditor?.id === productId) activeEditor = null;

		try {
			await updateProduct({
				id: product.id,
				variantId: product.variantId,
				...(nameChanged ? { name: state.name } : {}),
				...(unitTypeChanged ? { unitType: state.unitType } : {}),
				...(facetValueIds ? { facetValueIds } : {}),
			});

			// Optimistic updates
			if (nameChanged) product.name = state.name!;
			if (unitTypeChanged) product.unitType = state.unitType || null;
			if (bitsChanged) product.bits = allBits.filter((b) => state.bitIds!.includes(b.id));
			if (processChanged) product.processes = allProcesses.filter((p) => state.processIds!.includes(p.id));
			if (allergensChanged) product.allergenWarnings = allAllergenWarnings.filter((a) => state.allergenIds!.includes(a.id));
			products = [...products];
		} catch (err) {
			console.error('Failed to update product:', err);
			// Keep edits on error so the user can retry
			delete saving[productId];
			return;
		}

		delete saving[productId];
		delete edits[productId];
	}

	/**
	 * Check whether a row's edit state has any actual changes vs. the product data.
	 * Returns true if the edits are identical to the current product (i.e. no real changes).
	 */
	function isRowUnchanged(productId: string): boolean {
		const state = edits[productId];
		if (!state) return true;
		const product = products.find((p) => p.id === productId);
		if (!product) return true;

		const nameChanged = state.name !== undefined && state.name !== product.name;
		const unitTypeChanged = state.unitType !== undefined && state.unitType !== (product.unitType ?? '');
		const bitsChanged = state.bitIds !== undefined &&
			JSON.stringify([...state.bitIds].sort()) !== JSON.stringify(product.bits.map((b) => b.id).sort());
		const processChanged = state.processIds !== undefined &&
			JSON.stringify([...state.processIds].sort()) !== JSON.stringify(product.processes.map((p) => p.id).sort());
		const allergensChanged = state.allergenIds !== undefined &&
			JSON.stringify([...state.allergenIds].sort()) !== JSON.stringify(product.allergenWarnings.map((a) => a.id).sort());

		return !nameChanged && !unitTypeChanged && !bitsChanged && !processChanged && !allergensChanged;
	}

	/**
	 * Clear edit state for a row if no fields were actually changed.
	 * Called when the active editor is dismissed (blur, click-outside).
	 */
	function clearIfUnchanged(productId: string) {
		if (isRowUnchanged(productId)) {
			delete edits[productId];
		}
	}

	/** Discard all pending edits for a specific product row. */
	function cancelRow(productId: string) {
		delete edits[productId];
		if (activeEditor?.id === productId) activeEditor = null;
		editBitsSearch = '';
	}

	async function handleDelete(id: string) {
		deleting = true;
		try {
			await deleteProduct(id);
			products = products.filter((p) => p.id !== id);
		} catch (err) {
			console.error('Failed to delete product:', err);
		}
		deleting = false;
		confirmDeleteId = null;
	}

	async function reloadProducts() {
		try {
			products = await myProducts();
		} catch (err) {
			console.error('Failed to reload products:', err);
		}
	}

	/** Get the display label for a unit type value. */
	function unitTypeLabel(value: string | null): string {
		if (!value) return '—';
		return UNIT_TYPES.find((u) => u.value === value)?.label ?? value;
	}

	/** Toggle a facet value ID in an array (add if missing, remove if present). */
	function toggleId(ids: string[], id: string): string[] {
		return ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-32">
		<SpinnerSun class="size-8 text-muted-foreground" />
	</div>
{:else if loadError}
	<p class="mt-4 text-destructive">Error loading products: {loadError}</p>
{:else}
	<div class="space-y-2">
		<h2 class="pt-2 text-xl font-bold">Add Product</h2>

		<!-- Add product form -->
		<form
			class="space-y-5 rounded-md border px-3 pb-3 pt-1"
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
		>
			<!-- Row 1: Name, SKU, Unit Type -->
			<div class="flex flex-wrap items-end gap-2">
				<div class="min-w-[180px] flex-1">
					<label for="new-name" class="text-xs font-medium text-muted-foreground">Product Name</label>
					<Input
						id="new-name"
						bind:value={newName}
						bind:ref={nameInput}
						placeholder="e.g. Mixed Salad Greens"
					/>
				</div>
				<div class="w-32">
					<label for="new-sku" class="text-xs font-medium text-muted-foreground">SKU (optional)</label>
					<Input id="new-sku" bind:value={newSku} placeholder="Auto" />
				</div>
				<div class="relative w-40" bind:this={unitTypeContainerEl}>
					<label class="text-xs font-medium text-muted-foreground">Unit Type</label>
					<button
						type="button"
						class="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
						onclick={() => (unitTypeDropdownOpen = !unitTypeDropdownOpen)}
					>
						{unitTypeLabel(newUnitType)}
					</button>
					{#if unitTypeDropdownOpen}
						<div class="absolute top-full z-10 mt-1 w-44 rounded-md border bg-background shadow-lg">
							{#each UNIT_TYPES as unit (unit.value)}
								{@const isSelected = newUnitType === unit.value}
								<button
									type="button"
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent {isSelected ? 'font-medium' : ''}"
									onmousedown={(e) => e.preventDefault()}
									onclick={() => { newUnitType = unit.value; unitTypeDropdownOpen = false; }}
								>
									{#if isSelected}
										<span class="size-3.5 shrink-0 text-primary">&#10003;</span>
									{:else}
										<span class="size-3.5 shrink-0"></span>
									{/if}
									<span>{unit.label}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Row 2: Bits (ingredients) — searchable multi-select -->
			<div>
				<label for="bits-search" class="text-xs font-medium text-muted-foreground">
					Bits <span class="font-normal text-muted-foreground/70">(Ingredients — What's in it?)</span>
				</label>
				<!-- Selected bits pills -->
				{#if newBitIds.length > 0}
					<div class="mb-1 flex flex-wrap gap-1">
						{#each newBitIds as bitId (bitId)}
							{@const bit = allBits.find((b) => b.id === bitId)}
							{#if bit}
								<button
									type="button"
									class="inline-flex items-center gap-0.5 rounded-full border border-green-600/30 bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-600/20 dark:text-green-300"
									onclick={() => (newBitIds = newBitIds.filter((id) => id !== bitId))}
								>
									{bit.name}
									<span class="ml-0.5 text-[10px]">×</span>
								</button>
							{/if}
						{/each}
					</div>
				{/if}
				<!-- Search input -->
				<div class="relative" bind:this={bitsContainerEl}>
					<Input
						id="bits-search"
						bind:value={bitsSearch}
						bind:ref={bitsSearchInput}
						placeholder="Search ingredients..."
						onfocus={() => (bitsDropdownOpen = true)}
						class="h-8 text-sm"
					/>
					{#if bitsDropdownOpen}
						<!-- Dropdown list -->
						<div class="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
							{#if filteredBits.length === 0 && !canCreateBit}
								<p class="px-3 py-2 text-xs text-muted-foreground">No matches</p>
							{:else}
								{#each filteredBits as bit (bit.id)}
									<button
										type="button"
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
										onmousedown={(e) => e.preventDefault()}
									onclick={() => {
											newBitIds = toggleId(newBitIds, bit.id);
											bitsSearch = '';
										}}
									>
										<span class="size-3.5 shrink-0 rounded border {newBitIds.includes(bit.id) ? 'bg-green-600 border-green-600' : 'border-input'}"></span>
										<span>{bit.name}</span>
										{#if bit.group}
											<span class="ml-auto text-xs text-muted-foreground">{bit.group}</span>
										{/if}
									</button>
								{/each}
							{/if}
							{#if canCreateBit}
								<button
									type="button"
									class="flex w-full items-center gap-2 border-t px-3 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
									disabled={creatingBit}
									onclick={handleCreateBit}
								>
									{#if creatingBit}
										<SpinnerSun class="size-3.5 shrink-0" />
										Creating...
									{:else}
										<span class="text-xs">+</span>
										Create "{normalizedBitName}"
									{/if}
								</button>
							{/if}
							<button
								type="button"
								class="w-full border-t px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
								onclick={() => (bitsDropdownOpen = false)}
							>
								Close
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Row 3: Processing (toggle pills) -->
			<fieldset>
				<legend class="text-xs font-medium text-muted-foreground">
					Processing <span class="font-normal text-muted-foreground/70">(What was done to it?)</span>
				</legend>
				<div class="flex flex-wrap gap-1.5 pt-1">
					{#each allProcesses as proc (proc.id)}
						<button
							type="button"
							class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors
								{newProcessIds.includes(proc.id) ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-input text-muted-foreground hover:border-blue-500/50'}"
							onclick={() => (newProcessIds = toggleId(newProcessIds, proc.id))}
						>
							{proc.name}
						</button>
					{/each}
				</div>
			</fieldset>

			<!-- Row 4: Allergen Warnings (toggle pills) -->
			<fieldset>
				<legend class="text-xs font-medium text-muted-foreground">
					Allergen Warnings <span class="font-normal text-muted-foreground/70">(May have come in contact with...)</span>
				</legend>
				<div class="flex flex-wrap gap-1.5 pt-1">
					{#each allAllergenWarnings as warning (warning.id)}
						<button
							type="button"
							class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors
								{newAllergenIds.includes(warning.id) ? 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'border-input text-muted-foreground hover:border-orange-500/50'}"
							onclick={() => (newAllergenIds = toggleId(newAllergenIds, warning.id))}
						>
							{warning.name.replace(/^May contain /i, '')}
						</button>
					{/each}
				</div>
			</fieldset>

			<!-- Submit -->
			<div class="flex justify-center pt-1">
				<Button type="submit" disabled={newName.trim().length < 3} class="w-full max-w-md">Add Product</Button>
			</div>
		</form>

		<h2 class="mt-8 text-xl font-bold">Products</h2>

		{#if products.length === 0}
			<div class="flex items-center justify-center rounded-md border py-16">
				<p class="text-muted-foreground">No products yet. Add your first product above.</p>
			</div>
		{:else}
			<div class="overflow-visible rounded-md border">
				<Table.Table class="table-fixed">
					<Table.TableHeader>
						<Table.TableRow>
							<Table.TableHead>Product Name</Table.TableHead>
							<Table.TableHead class="w-[180px]">Bits</Table.TableHead>
							<Table.TableHead class="w-[120px]">Processing</Table.TableHead>
							<Table.TableHead class="w-[140px]">Allergens</Table.TableHead>
							<Table.TableHead class="w-36">Unit Type</Table.TableHead>
							<Table.TableHead class="w-40 text-right">Actions</Table.TableHead>
						</Table.TableRow>
					</Table.TableHeader>
					<Table.TableBody>
						{#each products as product (product.id)}
							{@const isPending = pendingIds.has(product.id)}
							{@const isFailed = failedIds.has(product.id)}
								{@const rowEdits = edits[product.id]}
							{@const isRowEditing = !!rowEdits}
							{@const isActiveRow = activeEditor?.id === product.id}
							{@const displayName = rowEdits?.name ?? product.name}
							{@const displayBits = rowEdits?.bitIds ? allBits.filter((b) => rowEdits.bitIds!.includes(b.id)) : product.bits}
							{@const displayProcesses = rowEdits?.processIds ? allProcesses.filter((p) => rowEdits.processIds!.includes(p.id)) : product.processes}
							{@const displayAllergens = rowEdits?.allergenIds ? allAllergenWarnings.filter((a) => rowEdits.allergenIds!.includes(a.id)) : product.allergenWarnings}
							{@const displayUnitType = rowEdits?.unitType ?? product.unitType}
							<Table.TableRow
										class={isPending ? 'opacity-50' : isFailed ? 'bg-destructive/5' : isRowEditing ? '' : 'hover:bg-accent'}
										style={isRowEditing ? 'background-color: light-dark(rgba(0,0,0,0.12), rgba(255,255,255,0.15))' : ''}
									>
								<!-- Product Name -->
								<Table.TableCell>
									{#if isPending}
										<span class="flex items-center gap-2">
											<SpinnerSun class="size-3.5 shrink-0 text-muted-foreground" />
											{product.name}
										</span>
									{:else if isFailed}
										<span class="text-destructive">{product.name}</span>
									{:else if isActiveRow && activeEditor.field === 'name'}
										<Input
											value={rowEdits?.name ?? product.name}
											oninput={(e) => updateEditState(product.id, { name: e.currentTarget.value })}
											onblur={() => { activeEditor = null; clearIfUnchanged(product.id); }}
											onkeydown={(e) => {
												if (e.key === 'Enter') { activeEditor = null; clearIfUnchanged(product.id); }
												if (e.key === 'Escape') cancelRow(product.id);
											}}
											disabled={saving[product.id]}
											class="h-7 text-sm"
											autofocus
										/>
									{:else}
										<button
											class="w-full cursor-text text-left hover:underline"
											onclick={() => openEditor(product, 'name')}
										>
											{displayName}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Bits (ingredients) -->
								<Table.TableCell class="overflow-visible">
									{#if isPending || isFailed}
										{#if product.bits.length > 0}
											<div class="flex flex-wrap gap-0.5">
												{#each product.bits as bit (bit.id)}
													<Badge variant="outline" class="border-green-600/30 bg-green-600/10 px-1.5 py-0 text-[11px] font-normal text-green-700 dark:text-green-300">{bit.name}</Badge>
												{/each}
											</div>
										{:else}
											<span class="text-xs text-muted-foreground">—</span>
										{/if}
									{:else if isActiveRow && activeEditor.field === 'bits'}
										<div class="relative w-full max-w-full" bind:this={editFacetContainerEl}>
											<Input
												bind:value={editBitsSearch}
												bind:ref={editBitsInput}
												placeholder="Search bits..."
												class="h-7 w-full text-sm"
												autofocus
											/>
											<div class="absolute top-full z-10 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-background shadow-lg">
												{#each filteredEditBits as bit (bit.id)}
													<button
														type="button"
														class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
														onmousedown={(e) => e.preventDefault()}
														onclick={() => { const cur = edits[product.id]?.bitIds ?? []; updateEditState(product.id, { bitIds: toggleId(cur, bit.id) }); }}
													>
														<span class="size-3.5 shrink-0 rounded border {rowEdits?.bitIds?.includes(bit.id) ? 'bg-green-600 border-green-600' : 'border-input'}"></span>
														<span>{bit.name}</span>
														{#if bit.group}
															<span class="ml-auto text-xs text-muted-foreground">{bit.group}</span>
														{/if}
													</button>
												{/each}
												{#if filteredEditBits.length === 0}
													<p class="px-3 py-2 text-xs text-muted-foreground">No matches</p>
												{/if}
											</div>
										</div>
									{:else}
										<button
											class="w-full cursor-pointer text-left"
											onclick={() => openEditor(product, 'bits')}
										>
											{#if displayBits.length > 0}
												<div class="flex flex-wrap gap-0.5">
													{#each displayBits.slice(0, 4) as bit (bit.id)}
														<Badge variant="outline" class="border-green-600/30 bg-green-600/10 px-1.5 py-0 text-[11px] font-normal text-green-700 dark:text-green-300">{bit.name}</Badge>
													{/each}
													{#if displayBits.length > 4}
														<Badge variant="outline" class="px-1.5 py-0 text-[11px] font-normal text-muted-foreground">+{displayBits.length - 4}</Badge>
													{/if}
												</div>
											{:else}
												<span class="text-xs text-muted-foreground hover:underline">—</span>
											{/if}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Processing -->
								<Table.TableCell>
									{#if isPending || isFailed}
										{#if product.processes.length > 0}
											<div class="flex flex-wrap gap-0.5">
												{#each product.processes as proc (proc.id)}
													<Badge variant="outline" class="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[11px] font-normal text-blue-700 dark:text-blue-300">{proc.name}</Badge>
												{/each}
											</div>
										{:else}
											<span class="text-xs text-muted-foreground">—</span>
										{/if}
									{:else}
										<div class="relative">
											<button
												class="w-full cursor-pointer text-left"
												onclick={() => openEditor(product, 'processes')}
											>
												{#if displayProcesses.length > 0}
													<div class="flex flex-wrap gap-0.5">
														{#each displayProcesses as proc (proc.id)}
															<Badge variant="outline" class="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[11px] font-normal text-blue-700 dark:text-blue-300">{proc.name}</Badge>
														{/each}
													</div>
												{:else}
													<span class="text-xs text-muted-foreground">—</span>
												{/if}
											</button>
											{#if isActiveRow && activeEditor.field === 'processes'}
												<div class="absolute top-full z-10 mt-1 w-48 rounded-md border bg-background shadow-lg" bind:this={editFacetContainerEl}>
													{#each allProcesses as proc (proc.id)}
														<button
															type="button"
															class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
															onmousedown={(e) => e.preventDefault()}
															onclick={() => { const cur = edits[product.id]?.processIds ?? []; updateEditState(product.id, { processIds: toggleId(cur, proc.id) }); }}
														>
															<span class="size-3.5 shrink-0 rounded border {rowEdits?.processIds?.includes(proc.id) ? 'bg-blue-500 border-blue-500' : 'border-input'}"></span>
															<span>{proc.name}</span>
														</button>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</Table.TableCell>

								<!-- Allergen Warnings -->
								<Table.TableCell>
									{#if isPending || isFailed}
										{#if product.allergenWarnings.length > 0}
											<div class="flex flex-wrap gap-0.5">
												{#each product.allergenWarnings as warning (warning.id)}
													<Badge variant="outline" class="border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[11px] font-normal text-orange-700 dark:text-orange-300">{warning.name.replace(/^May contain /i, '')}</Badge>
												{/each}
											</div>
										{:else}
											<span class="text-xs text-muted-foreground">—</span>
										{/if}
									{:else}
										<div class="relative">
											<button
												class="w-full cursor-pointer text-left"
												onclick={() => openEditor(product, 'allergens')}
											>
												{#if displayAllergens.length > 0}
													<div class="flex flex-wrap gap-0.5">
														{#each displayAllergens as warning (warning.id)}
															<Badge variant="outline" class="border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[11px] font-normal text-orange-700 dark:text-orange-300">{warning.name.replace(/^May contain /i, '')}</Badge>
														{/each}
													</div>
												{:else}
													<span class="text-xs text-muted-foreground">—</span>
												{/if}
											</button>
											{#if isActiveRow && activeEditor.field === 'allergens'}
												<div class="absolute top-full z-10 mt-1 w-52 rounded-md border bg-background shadow-lg" bind:this={editFacetContainerEl}>
													{#each allAllergenWarnings as warning (warning.id)}
														<button
															type="button"
															class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
															onmousedown={(e) => e.preventDefault()}
															onclick={() => { const cur = edits[product.id]?.allergenIds ?? []; updateEditState(product.id, { allergenIds: toggleId(cur, warning.id) }); }}
														>
															<span class="size-3.5 shrink-0 rounded border {rowEdits?.allergenIds?.includes(warning.id) ? 'bg-orange-500 border-orange-500' : 'border-input'}"></span>
															<span>{warning.name.replace(/^May contain /i, '')}</span>
														</button>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</Table.TableCell>

								<!-- Unit Type -->
								<Table.TableCell>
									{#if isPending || isFailed}
										<span class="text-muted-foreground">{unitTypeLabel(product.unitType)}</span>
									{:else}
										<div class="relative">
											<button
												class="w-full cursor-pointer text-left text-muted-foreground"
												onclick={() => openEditor(product, 'unitType')}
											>
												{unitTypeLabel(displayUnitType)}
											</button>
											{#if isActiveRow && activeEditor.field === 'unitType'}
												<div class="absolute top-full z-10 mt-1 w-44 rounded-md border bg-background shadow-lg" bind:this={editFacetContainerEl}>
													{#each UNIT_TYPES as unit (unit.value)}
														{@const isSelected = (rowEdits?.unitType ?? product.unitType ?? '') === unit.value}
														<button
															type="button"
															class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent {isSelected ? 'font-medium' : ''}"
															onmousedown={(e) => e.preventDefault()}
															onclick={() => updateEditState(product.id, { unitType: unit.value })}
														>
															{#if isSelected}
																<span class="size-3.5 shrink-0 text-primary">&#10003;</span>
															{:else}
																<span class="size-3.5 shrink-0"></span>
															{/if}
															<span>{unit.label}</span>
														</button>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</Table.TableCell>

								<!-- Actions -->
								<Table.TableCell class="w-40 text-right">
									{#if isPending}
										<span class="text-xs text-muted-foreground">Saving...</span>
									{:else if isFailed}
										<div class="flex items-center justify-end gap-1">
											<Button
												size="sm"
												variant="ghost"
												onclick={() => retryCreate(product.id)}
												class="text-xs"
											>
												Retry
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onclick={() => dismissFailed(product.id)}
												class="text-xs text-destructive hover:text-destructive"
											>
												Dismiss
											</Button>
										</div>
									{:else if isRowEditing}
										<div class="flex items-center justify-end gap-1">
											<Button
												size="sm"
												disabled={saving[product.id]}
												onmousedown={(e: MouseEvent) => e.stopPropagation()}
												onclick={() => saveRow(product.id)}
											>
												{#if saving[product.id]}
													<SpinnerSun class="size-3.5" />
												{:else}
													Save
												{/if}
											</Button>
											<Button size="sm" variant="ghost" disabled={saving[product.id]} onmousedown={(e: MouseEvent) => e.stopPropagation()} onclick={() => cancelRow(product.id)}>
												Cancel
											</Button>
										</div>
									{:else if confirmDeleteId === product.id}
										<div class="flex items-center justify-end gap-1">
											<Button
												size="sm"
												variant="destructive"
												disabled={deleting}
												onclick={() => handleDelete(product.id)}
											>
												{#if deleting}<SpinnerSun class="size-3.5" />{:else}Yes{/if}
											</Button>
											<Button size="sm" variant="ghost" onclick={() => (confirmDeleteId = null)}>
												No
											</Button>
										</div>
									{:else}
										<Button
											size="sm"
											variant="ghost"
											onclick={() => (confirmDeleteId = product.id)}
											class="text-destructive hover:text-destructive"
										>
											Delete
										</Button>
									{/if}
								</Table.TableCell>
							</Table.TableRow>
						{/each}
					</Table.TableBody>
				</Table.Table>
			</div>
		{/if}
	</div>
{/if}
