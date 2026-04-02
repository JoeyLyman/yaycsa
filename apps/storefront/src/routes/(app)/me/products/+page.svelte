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
	import { AddProductForm } from '$lib/components/bundles/add-product-form';
	import { ProductList } from '$lib/components/bundles/product-list';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';

	/** All available unit type options. */
	const UNIT_TYPES: InputSelectItem[] = [
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
	];

	/** Convert a FacetValueInfo to the generic InputSelectItem format. */
	function toItem(f: FacetValueInfo): InputSelectItem {
		return { value: f.id, label: f.name, group: f.group };
	}

	// ─── Product state ───

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

	/** Raw taxonomy — FacetValueInfo arrays from the server. */
	let rawBits: FacetValueInfo[] = $state([]);
	let rawProcesses: FacetValueInfo[] = $state([]);
	let rawAllergenWarnings: FacetValueInfo[] = $state([]);

	/** Taxonomy as InputSelectItem arrays for the components. */
	let allBits = $derived(rawBits.map(toItem));
	let allProcesses = $derived(rawProcesses.map(toItem));
	let allAllergenWarnings = $derived(rawAllergenWarnings.map(toItem));

	/** Default process ID to pre-select "Raw / Fresh" in the add form. */
	let defaultProcessId = $derived(rawProcesses.find((p) => p.code === 'raw')?.id);

	// ─── Optimistic create state ───

	/** Counter for generating unique temporary IDs for optimistic inserts. */
	let tempIdCounter = 0;

	/**
	 * Set of temporary IDs for products that are currently being created on the server.
	 * Products with these IDs show an inline loading state in the table.
	 */
	let pendingIds = new SvelteSet<string>();

	/**
	 * Map of temporary IDs to error messages for products that failed to create.
	 * Products with these IDs show an inline error state with a retry option.
	 */
	let failedIds = new SvelteMap<string, string>();

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
				fetchAllergenWarnings()
			]);
			products = prods;
			rawBits = bits;
			rawProcesses = procs.sort((a, b) => a.name.localeCompare(b.name));
			rawAllergenWarnings = allergens.sort((a, b) => a.name.localeCompare(b.name));
		} catch (err) {
			loadError =
				err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
			console.error('Failed to load products:', err);
		}
		loading = false;
	}

	// ─── Handlers ───

	async function handleCreate(data: {
		name: string;
		unitType: string;
		bitIds: string[];
		processIds: string[];
		allergenIds: string[];
	}) {
		const sku = data.name.toUpperCase().replace(/\s+/g, '-');
		const unitType = data.unitType || undefined;
		const facetValueIds = [...data.bitIds, ...data.processIds, ...data.allergenIds];

		// Generate a temporary ID and optimistically insert into the table
		const tempId = `__pending_${++tempIdCounter}`;
		const optimisticProduct: SellerProduct = {
			id: tempId,
			name: data.name,
			variantId: '',
			sku,
			unitType: unitType ?? null,
			bits: rawBits.filter((b) => data.bitIds.includes(b.id)),
			processes: rawProcesses.filter((p) => data.processIds.includes(p.id)),
			allergenWarnings: rawAllergenWarnings.filter((a) => data.allergenIds.includes(a.id))
		};

		products = [...products, optimisticProduct];
		pendingIds.add(tempId);

		try {
			const created = await createProduct({
				name: data.name,
				sku,
				unitType,
				facetValueIds: facetValueIds.length ? facetValueIds : undefined
			});
			products = products.map((p) => (p.id === tempId ? created : p));
			pendingIds.delete(tempId);
		} catch (err) {
			console.error('Failed to create product:', err);
			pendingIds.delete(tempId);
			failedIds.set(tempId, 'Failed to create');
		}
	}

	async function handleCreateBit(name: string): Promise<InputSelectItem | null> {
		try {
			const newBit = await createBit({ name });
			// Add to local taxonomy cache (skip if already present — server-side dedup)
			if (!rawBits.some((b) => b.id === newBit.id)) {
				rawBits = [...rawBits, newBit];
			}
			return toItem(newBit);
		} catch (err) {
			console.error('Failed to create bit:', err);
			return null;
		}
	}

	function retryCreate(tempId: string) {
		const product = products.find((p) => p.id === tempId);
		if (!product) return;

		failedIds.delete(tempId);
		pendingIds.add(tempId);

		const facetValueIds = [
			...product.bits.map((b) => b.id),
			...product.processes.map((p) => p.id),
			...product.allergenWarnings.map((a) => a.id)
		];

		createProduct({
			name: product.name,
			sku: product.sku || undefined,
			unitType: product.unitType || undefined,
			facetValueIds: facetValueIds.length ? facetValueIds : undefined
		})
			.then((created) => {
				products = products.map((p) => (p.id === tempId ? created : p));
				pendingIds.delete(tempId);
			})
			.catch((err) => {
				console.error('Failed to create product (retry):', err);
				pendingIds.delete(tempId);
				failedIds.set(tempId, 'Failed to create');
			});
	}

	function dismissFailed(tempId: string) {
		products = products.filter((p) => p.id !== tempId);
		failedIds.delete(tempId);
	}

	async function handleSave(
		productId: string,
		edits: { name?: string; unitType?: string; facetValueIds?: string[] }
	) {
		const product = products.find((p) => p.id === productId);
		if (!product) return;

		await updateProduct({
			id: product.id,
			variantId: product.variantId,
			...edits
		});

		// Optimistic updates
		if (edits.name) product.name = edits.name;
		if (edits.unitType !== undefined) product.unitType = edits.unitType || null;
		if (edits.facetValueIds) {
			product.bits = rawBits.filter((b) => edits.facetValueIds!.includes(b.id));
			product.processes = rawProcesses.filter((p) => edits.facetValueIds!.includes(p.id));
			product.allergenWarnings = rawAllergenWarnings.filter((a) =>
				edits.facetValueIds!.includes(a.id)
			);
		}
		products = [...products]; // trigger reactivity
	}

	async function handleDelete(productId: string) {
		await deleteProduct(productId);
		products = products.filter((p) => p.id !== productId);
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

		<AddProductForm
			{allBits}
			{allProcesses}
			{allAllergenWarnings}
			unitTypes={UNIT_TYPES}
			{defaultProcessId}
			oncreate={handleCreate}
			onCreateBit={handleCreateBit}
		/>

		<h2 class="mt-8 text-xl font-bold">Products</h2>

		<ProductList
			{products}
			{allBits}
			{allProcesses}
			{allAllergenWarnings}
			unitTypes={UNIT_TYPES}
			{pendingIds}
			{failedIds}
			onsave={handleSave}
			ondelete={handleDelete}
			onretry={retryCreate}
			ondismiss={dismissFailed}
			onCreateBit={handleCreateBit}
		/>
	</div>
{/if}
