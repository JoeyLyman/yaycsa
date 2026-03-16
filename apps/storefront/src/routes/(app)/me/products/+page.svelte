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
	import { tick } from 'svelte';

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

	/**
	 * Which cell is currently being edited.
	 * null when no cell is in edit mode.
	 */
	let editing: { id: string; field: 'name' | 'sku' | 'unitType' | 'bits' | 'processes' | 'allergens' } | null = $state(null);

	/** Temporary value while editing a text/select cell. */
	let editValue = $state('');

	/** Temporary facet value IDs while editing a facet column (bits/processes/allergens). */
	let editFacetIds: string[] = $state([]);

	/** Search filter for the bits typeahead when editing an existing product's bits. */
	let editBitsSearch = $state('');

	/** Reference to the edit bits search input for re-focusing after selection. */
	let editBitsInput: HTMLInputElement | null = $state(null);

	/**
	 * Whether the facet edit dropdown is currently visible.
	 * Separate from `editing` so the dropdown can close while the edit (Save/Cancel) stays active.
	 */
	let editDropdownOpen = $state(false);

	/** Whether an update is in flight. */
	let updating = $state(false);

	/**
	 * Reference to the edit facet dropdown container for click-outside detection.
	 * Bound to whichever facet dropdown is currently open.
	 */
	let editFacetContainerEl: HTMLDivElement | null = $state(null);

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

	/** Close an edit facet dropdown when clicking outside it. */
	function handleEditFacetClickOutside(event: MouseEvent) {
		if (editFacetContainerEl && !editFacetContainerEl.contains(event.target as Node)) {
			cancelEdit();
		}
	}

	$effect(() => {
		if (bitsDropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	});

	$effect(() => {
		if (editing && ['bits', 'processes', 'allergens'].includes(editing.field)) {
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

	function startEdit(product: SellerProduct, field: 'name' | 'sku' | 'unitType' | 'bits' | 'processes' | 'allergens') {
		editing = { id: product.id, field };
		editDropdownOpen = false;
		if (field === 'name' || field === 'sku') {
			editValue = product[field];
		} else if (field === 'unitType') {
			editValue = product.unitType ?? '';
		} else if (field === 'bits') {
			editFacetIds = product.bits.map((b) => b.id);
			editBitsSearch = '';
			editDropdownOpen = true;
		} else if (field === 'processes') {
			editFacetIds = product.processes.map((p) => p.id);
			editDropdownOpen = true;
		} else if (field === 'allergens') {
			editFacetIds = product.allergenWarnings.map((a) => a.id);
			editDropdownOpen = true;
		}
	}

	async function saveEdit() {
		if (!editing) return;
		const { id, field } = editing;
		const product = products.find((p) => p.id === id);
		if (!product) return;

		// Check if anything actually changed
		if (field === 'name' || field === 'sku') {
			if (editValue === product[field]) { editing = null; return; }
		} else if (field === 'unitType') {
			if (editValue === (product.unitType ?? '')) { editing = null; return; }
		} else {
			const currentIds = (
				field === 'bits' ? product.bits :
				field === 'processes' ? product.processes :
				product.allergenWarnings
			).map((f) => f.id).sort().join(',');
			if ([...editFacetIds].sort().join(',') === currentIds) { editing = null; return; }
		}

		updating = true;

		try {
			if (field === 'bits' || field === 'processes' || field === 'allergens') {
				// Merge: keep other facet categories unchanged, replace this one
				const bitIds = field === 'bits' ? editFacetIds : product.bits.map((b) => b.id);
				const processIds = field === 'processes' ? editFacetIds : product.processes.map((p) => p.id);
				const allergenIds = field === 'allergens' ? editFacetIds : product.allergenWarnings.map((a) => a.id);

				await updateProduct({
					id: product.id,
					variantId: product.variantId,
					facetValueIds: [...bitIds, ...processIds, ...allergenIds],
				});

				// Optimistic update
				if (field === 'bits') product.bits = allBits.filter((b) => editFacetIds.includes(b.id));
				else if (field === 'processes') product.processes = allProcesses.filter((p) => editFacetIds.includes(p.id));
				else product.allergenWarnings = allAllergenWarnings.filter((a) => editFacetIds.includes(a.id));
				products = [...products];
			} else {
				await updateProduct({
					id: product.id,
					variantId: product.variantId,
					[field]: editValue,
				});

				// Optimistic update
				if (field === 'name') product.name = editValue;
				else if (field === 'sku') product.sku = editValue;
				else if (field === 'unitType') product.unitType = editValue || null;
			}
		} catch (err) {
			console.error('Failed to update product:', err);
		}

		updating = false;
		editing = null;
		editDropdownOpen = false;
	}

	function cancelEdit() {
		editing = null;
		editValue = '';
		editFacetIds = [];
		editBitsSearch = '';
		editDropdownOpen = false;
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
				<div class="w-40">
					<label for="new-unit" class="text-xs font-medium text-muted-foreground">Unit Type</label>
					<select
						id="new-unit"
						bind:value={newUnitType}
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
					>
						{#each UNIT_TYPES as unit (unit.value)}
							<option value={unit.value}>{unit.label}</option>
						{/each}
					</select>
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
			<div class="overflow-x-auto rounded-md border">
				<Table.Table>
					<Table.TableHeader>
						<Table.TableRow>
							<Table.TableHead class="min-w-[200px]">Product Name</Table.TableHead>
							<Table.TableHead class="min-w-[180px]">Bits</Table.TableHead>
							<Table.TableHead class="min-w-[120px]">Processing</Table.TableHead>
							<Table.TableHead class="min-w-[140px]">Allergens</Table.TableHead>
							<Table.TableHead class="w-36">Unit Type</Table.TableHead>
							<Table.TableHead class="w-32 text-right">Actions</Table.TableHead>
						</Table.TableRow>
					</Table.TableHeader>
					<Table.TableBody>
						{#each products as product (product.id)}
							{@const isPending = pendingIds.has(product.id)}
							{@const isFailed = failedIds.has(product.id)}
							{@const isEditing = editing?.id === product.id}
							<Table.TableRow class={isPending ? 'opacity-50' : isFailed ? 'bg-destructive/5' : ''}>
								<!-- Product Name (inline editable) -->
								<Table.TableCell>
									{#if isPending}
										<span class="flex items-center gap-2">
											<SpinnerSun class="size-3.5 shrink-0 text-muted-foreground" />
											{product.name}
										</span>
									{:else if isFailed}
										<span class="text-destructive">{product.name}</span>
									{:else if isEditing && editing?.field === 'name'}
										<!-- svelte-ignore a11y_autofocus -->
										<Input
											bind:value={editValue}
											onkeydown={(e) => {
												if (e.key === 'Enter') saveEdit();
												if (e.key === 'Escape') cancelEdit();
											}}
											disabled={updating}
											class="h-7 text-sm"
											autofocus
										/>
									{:else}
										<button
											class="w-full cursor-text text-left hover:underline"
											onclick={() => startEdit(product, 'name')}
										>
											{product.name}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Bits (ingredients) — clickable to edit -->
								<Table.TableCell>
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
									{:else if isEditing && editing?.field === 'bits'}
										<div class="relative" bind:this={editFacetContainerEl}>
											<Input
												bind:value={editBitsSearch}
												bind:ref={editBitsInput}
												placeholder="Search bits..."
												class="h-7 text-sm"
												autofocus
											/>
											<div class="absolute z-10 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-background shadow-lg">
												{#each filteredEditBits as bit (bit.id)}
													<button
														type="button"
														class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
														onclick={async () => { editFacetIds = toggleId(editFacetIds, bit.id); await tick(); editBitsInput?.focus(); }}
													>
														<span class="size-3.5 shrink-0 rounded border {editFacetIds.includes(bit.id) ? 'bg-green-600 border-green-600' : 'border-input'}"></span>
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
											onclick={() => startEdit(product, 'bits')}
										>
											{#if product.bits.length > 0}
												<div class="flex flex-wrap gap-0.5">
													{#each product.bits.slice(0, 4) as bit (bit.id)}
														<Badge variant="outline" class="border-green-600/30 bg-green-600/10 px-1.5 py-0 text-[11px] font-normal text-green-700 dark:text-green-300">{bit.name}</Badge>
													{/each}
													{#if product.bits.length > 4}
														<Badge variant="outline" class="px-1.5 py-0 text-[11px] font-normal text-muted-foreground">+{product.bits.length - 4}</Badge>
													{/if}
												</div>
											{:else}
												<span class="text-xs text-muted-foreground hover:underline">—</span>
											{/if}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Processing — clickable to edit -->
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
									{:else if isEditing && editing?.field === 'processes'}
										<div class="relative" bind:this={editFacetContainerEl}>
											<div class="absolute z-10 w-48 rounded-md border bg-background shadow-lg">
												{#each allProcesses as proc (proc.id)}
													<button
														type="button"
														class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
														onclick={() => (editFacetIds = toggleId(editFacetIds, proc.id))}
													>
														<span class="size-3.5 shrink-0 rounded border {editFacetIds.includes(proc.id) ? 'bg-blue-500 border-blue-500' : 'border-input'}"></span>
														<span>{proc.name}</span>
													</button>
												{/each}
											</div>
										</div>
									{:else}
										<button
											class="w-full cursor-pointer text-left"
											onclick={() => startEdit(product, 'processes')}
										>
											{#if product.processes.length > 0}
												<div class="flex flex-wrap gap-0.5">
													{#each product.processes as proc (proc.id)}
														<Badge variant="outline" class="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[11px] font-normal text-blue-700 dark:text-blue-300">{proc.name}</Badge>
													{/each}
												</div>
											{:else}
												<span class="text-xs text-muted-foreground hover:underline">—</span>
											{/if}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Allergen Warnings — clickable to edit -->
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
									{:else if isEditing && editing?.field === 'allergens'}
										<div class="relative" bind:this={editFacetContainerEl}>
											<div class="absolute z-10 w-52 rounded-md border bg-background shadow-lg">
												{#each allAllergenWarnings as warning (warning.id)}
													<button
														type="button"
														class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
														onclick={() => (editFacetIds = toggleId(editFacetIds, warning.id))}
													>
														<span class="size-3.5 shrink-0 rounded border {editFacetIds.includes(warning.id) ? 'bg-orange-500 border-orange-500' : 'border-input'}"></span>
														<span>{warning.name.replace(/^May contain /i, '')}</span>
													</button>
												{/each}
											</div>
										</div>
									{:else}
										<button
											class="w-full cursor-pointer text-left"
											onclick={() => startEdit(product, 'allergens')}
										>
											{#if product.allergenWarnings.length > 0}
												<div class="flex flex-wrap gap-0.5">
													{#each product.allergenWarnings as warning (warning.id)}
														<Badge variant="outline" class="border-orange-500/30 bg-orange-500/10 px-1.5 py-0 text-[11px] font-normal text-orange-700 dark:text-orange-300">{warning.name.replace(/^May contain /i, '')}</Badge>
													{/each}
												</div>
											{:else}
												<span class="text-xs text-muted-foreground hover:underline">—</span>
											{/if}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Unit Type (inline editable via dropdown) -->
								<Table.TableCell>
									{#if isPending || isFailed}
										<span class="text-muted-foreground">{unitTypeLabel(product.unitType)}</span>
									{:else if isEditing && editing?.field === 'unitType'}
										<!-- svelte-ignore a11y_autofocus -->
										<select
											bind:value={editValue}
											onkeydown={(e) => {
												if (e.key === 'Escape') cancelEdit();
											}}
											disabled={updating}
											class="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-0 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
											autofocus
										>
											{#each UNIT_TYPES as unit (unit.value)}
												<option value={unit.value}>{unit.label}</option>
											{/each}
										</select>
									{:else}
										<button
											class="w-full cursor-text text-left text-muted-foreground hover:underline"
											onclick={() => startEdit(product, 'unitType')}
										>
											{unitTypeLabel(product.unitType)}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Actions: Save/Cancel when editing, Delete otherwise -->
								<Table.TableCell class="text-right">
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
									{:else if isEditing}
										<div class="flex items-center justify-end gap-1">
											<Button
												size="sm"
												disabled={updating}
												onclick={saveEdit}
											>
												{#if updating}
													<SpinnerSun class="size-3.5" />
												{:else}
													Save
												{/if}
											</Button>
											<Button size="sm" variant="ghost" disabled={updating} onclick={cancelEdit}>
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
												{deleting ? '...' : 'Yes'}
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
