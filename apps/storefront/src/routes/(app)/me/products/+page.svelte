<script lang="ts">
	import {
		myProducts,
		createProduct,
		updateProduct,
		deleteProduct,
		type SellerProduct
	} from '$lib/api/admin/products.remote';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Button } from '$lib/components/bits/button';
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

	// ─── Add product form state ───

	/** Name input for the add-product row. */
	let newName = $state('');

	/** SKU input for the add-product row (optional — auto-generated if blank). */
	let newSku = $state('');

	/** Unit type selection for the add-product row. */
	let newUnitType = $state('');

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
	let editing: { id: string; field: 'name' | 'sku' | 'unitType' } | null = $state(null);

	/** Temporary value while editing a cell. */
	let editValue = $state('');

	/** Whether an update is in flight. */
	let updating = $state(false);

	// ─── Delete state ───

	/** Product ID pending delete confirmation. */
	let confirmDeleteId: string | null = $state(null);

	/** Whether a delete is in flight. */
	let deleting = $state(false);

	// ─── Initial data load ───

	$effect(() => {
		loadProducts();
	});

	async function loadProducts() {
		loading = true;
		loadError = null;
		try {
			products = await myProducts();
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

		// Generate a temporary ID and optimistically insert into the table
		const tempId = `__pending_${++tempIdCounter}`;
		const optimisticProduct: SellerProduct = {
			id: tempId,
			name,
			variantId: '',
			sku: sku ?? name.toUpperCase().replace(/\s+/g, '-'),
			unitType: unitType ?? null
		};

		products = [...products, optimisticProduct];
		pendingIds = new Set([...pendingIds, tempId]);

		// Clear form immediately so the user can keep adding
		newName = '';
		newSku = '';
		newUnitType = '';
		nameInput?.focus();

		try {
			const created = await createProduct({ name, sku, unitType });

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

		try {
			const created = await createProduct({
				name: product.name,
				sku: product.sku || undefined,
				unitType: product.unitType || undefined
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

	function startEdit(product: SellerProduct, field: 'name' | 'sku' | 'unitType') {
		editing = { id: product.id, field };
		editValue = field === 'unitType' ? (product.unitType ?? '') : product[field];
	}

	async function saveEdit() {
		if (!editing) return;
		const { id, field } = editing;
		const product = products.find((p) => p.id === id);
		if (!product) return;

		const currentValue = field === 'unitType' ? (product.unitType ?? '') : product[field];
		if (editValue === currentValue) {
			editing = null;
			return;
		}

		updating = true;

		try {
			await updateProduct({
				id: product.id,
				variantId: product.variantId,
				[field]: editValue
			});

			// Optimistic update
			if (field === 'name') product.name = editValue;
			else if (field === 'sku') product.sku = editValue;
			else if (field === 'unitType') product.unitType = editValue || null;
		} catch (err) {
			console.error('Failed to update product:', err);
		}

		updating = false;
		editing = null;
	}

	function cancelEdit() {
		editing = null;
		editValue = '';
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
			products = await myProducts().refresh();
		} catch (err) {
			console.error('Failed to reload products:', err);
		}
	}

	/** Get the display label for a unit type value. */
	function unitTypeLabel(value: string | null): string {
		if (!value) return '—';
		return UNIT_TYPES.find((u) => u.value === value)?.label ?? value;
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

		<!-- Add product row -->
		<form
			class="flex flex-wrap items-end gap-2 rounded-md border p-3"
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
		>
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
				<label for="new-sku" class="text-xs font-medium text-muted-foreground">SKU (optional)</label
				>
				<Input id="new-sku" bind:value={newSku} placeholder="Auto" />
			</div>
			<div class="w-40">
				<label for="new-unit" class="text-xs font-medium text-muted-foreground">Unit Type</label>
				<select
					id="new-unit"
					bind:value={newUnitType}
					class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
				>
					{#each UNIT_TYPES as unit}
						<option value={unit.value}>{unit.label}</option>
					{/each}
				</select>
			</div>
			<Button type="submit" disabled={!newName.trim()} size="sm">Add</Button>
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
							<Table.TableHead class="w-36">SKU</Table.TableHead>
							<Table.TableHead class="w-40">Unit Type</Table.TableHead>
							<Table.TableHead class="w-24 text-right">Actions</Table.TableHead>
						</Table.TableRow>
					</Table.TableHeader>
					<Table.TableBody>
						{#each products as product (product.id)}
							{@const isPending = pendingIds.has(product.id)}
							{@const isFailed = failedIds.has(product.id)}
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
									{:else if editing?.id === product.id && editing.field === 'name'}
										<Input
											bind:value={editValue}
											onblur={saveEdit}
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

								<!-- SKU (inline editable) -->
								<Table.TableCell>
									{#if isPending || isFailed}
										<span class="text-muted-foreground">{product.sku || '—'}</span>
									{:else if editing?.id === product.id && editing.field === 'sku'}
										<Input
											bind:value={editValue}
											onblur={saveEdit}
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
											class="w-full cursor-text text-left text-muted-foreground hover:underline"
											onclick={() => startEdit(product, 'sku')}
										>
											{product.sku || '—'}
										</button>
									{/if}
								</Table.TableCell>

								<!-- Unit Type (inline editable via dropdown) -->
								<Table.TableCell>
									{#if isPending || isFailed}
										<span class="text-muted-foreground">{unitTypeLabel(product.unitType)}</span>
									{:else if editing?.id === product.id && editing.field === 'unitType'}
										<select
											bind:value={editValue}
											onblur={saveEdit}
											onchange={saveEdit}
											disabled={updating}
											class="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-0 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
											autofocus
										>
											{#each UNIT_TYPES as unit}
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

								<!-- Actions -->
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
