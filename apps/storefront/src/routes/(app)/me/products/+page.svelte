<script lang="ts">
	import {
		myProducts,
		createProduct,
		updateProduct,
		deleteProduct as deleteRemoteProduct,
		createBit,
		fetchBits,
		fetchProcessTypes,
		fetchAllergenWarnings,
		type SellerProduct,
		type FacetValueInfo
	} from '$lib/api/admin/products.remote';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Button } from '$lib/components/bits/button';
	import { ProductList } from '$lib/components/bundles/product-list';
	import {
		TableEditModeToggle,
		setTableEditModeContext
	} from '$lib/components/blocks/table-edit-mode';
	import {
		TableDetailToggle,
		type TableDetailMode
	} from '$lib/components/blocks/table-detail-toggle';
	import type {
		ProductDraft,
		ProductDraftPatch
	} from '$lib/components/bundles/product-list/product-list-types';
	import type { InputSelectItem } from '$lib/components/blocks/input-select';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';

	/** Convert a FacetValueInfo to the generic InputSelectItem format. */
	function toItem(facetValue: FacetValueInfo): InputSelectItem {
		return { value: facetValue.id, label: facetValue.name, group: facetValue.group };
	}

	/** Build the default shape for a newly added unsaved draft row. */
	function createBlankProductDraft(id: string): ProductDraft {
		return {
			id,
			name: '',
			bitIds: [],
			processIds: [],
			allergenIds: []
		};
	}

	/** Generate an optimistic SKU from a product name for pending rows. */
	function generateProductSku(name: string): string {
		return name
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	/** Convert unknown thrown values into a readable fallback message. */
	function getErrorMessage(error: unknown, fallbackMessage: string): string {
		if (error instanceof Error && error.message) return error.message;
		if (typeof error === 'string' && error.length > 0) return error;
		return fallbackMessage;
	}

	/**
	 * Local mutable copy of saved products.
	 * Updated optimistically on create, update, retry-dismiss, and delete.
	 */
	let products: SellerProduct[] = $state([]);

	/**
	 * Unsaved inline draft rows currently shown at the bottom of the product table.
	 * Multiple drafts can exist at once so sellers can batch-enter products.
	 */
	let productDrafts: ProductDraft[] = $state([]);

	/** Whether the initial product + taxonomy load is still in flight. */
	let loading = $state(true);

	/** Error from the initial load or a later reload attempt. */
	let loadError: string | null = $state(null);

	/** Raw bit taxonomy from the server before UI mapping / sorting. */
	let rawBits: FacetValueInfo[] = $state([]);

	/** Raw processing taxonomy from the server before UI mapping / sorting. */
	let rawProcesses: FacetValueInfo[] = $state([]);

	/** Raw allergen taxonomy from the server before UI mapping / sorting. */
	let rawAllergenWarnings: FacetValueInfo[] = $state([]);

	/** Sorted bit options shared by saved rows and draft rows. */
	let allBits = $derived(rawBits.map(toItem).sort((left, right) => left.label.localeCompare(right.label)));

	/** Sorted processing options shared by saved rows and draft rows. */
	let allProcesses = $derived(rawProcesses.map(toItem));

	/** Sorted allergen-warning options shared by saved rows and draft rows. */
	let allAllergenWarnings = $derived(rawAllergenWarnings.map(toItem));

	/**
	 * Global metadata visibility mode for the product table.
	 * Toggled via the Detail button between `summary` (one-line) and `expanded` (full editors).
	 * Forced to `expanded` when entering edit mode so the disabled Detail button visually reflects the lock.
	 */
	let metadataMode = $state<TableDetailMode>('summary');

	/** Counter for generating stable temporary IDs for optimistic pending products. */
	let pendingProductIdCounter = 0;

	/** Counter for generating stable IDs for unsaved inline draft rows. */
	let productDraftIdCounter = 0;

	/**
	 * Set of temporary product IDs currently being created on the server.
	 * These rows stay in the saved-product list and show inline pending UI.
	 */
	let pendingIds = new SvelteSet<string>();

	/**
	 * Map of temporary product IDs to create errors.
	 * Failed pending rows stay visible so sellers can retry or dismiss them.
	 */
	let failedIds = new SvelteMap<string, string>();

	/** Whether the product table is currently in edit mode. */
	let editMode = $state(false);

	/** Bumped whenever edit mode exits via Discard so rows remount and drop local state. */
	let editSessionId = $state(0);

	/** IDs of saved rows that have pending (unsaved) edits, registered by the rows via context. */
	let dirtyRowIds = new SvelteSet<string>();

	/** Whether the table has any unsaved edits or open drafts. Drives the exit-confirm dialog. */
	let hasUnsavedChanges = $derived(dirtyRowIds.size > 0 || productDrafts.length > 0);

	setTableEditModeContext({
		editMode: () => editMode,
		registerDirty: (id, dirty) => {
			if (dirty) dirtyRowIds.add(id);
			else dirtyRowIds.delete(id);
		},
		unregisterDirty: (id) => dirtyRowIds.delete(id)
	});

	function handleEditModeChange(next: boolean) {
		if (!next) {
			productDrafts = [];
			dirtyRowIds.clear();
			editSessionId += 1;
		} else {
			metadataMode = 'expanded';
		}
		editMode = next;
	}

	loadAll();

	async function loadAll() {
		loading = true;
		loadError = null;
		try {
			const [loadedProducts, bits, processes, allergenWarnings] = await Promise.all([
				myProducts(),
				fetchBits(),
				fetchProcessTypes(),
				fetchAllergenWarnings()
			]);
			products = loadedProducts;
			rawBits = bits;
			rawProcesses = processes.sort((left, right) => left.name.localeCompare(right.name));
			rawAllergenWarnings = allergenWarnings.sort((left, right) =>
				left.name.localeCompare(right.name)
			);
		} catch (error) {
			loadError = getErrorMessage(error, 'Failed to load products');
			console.error('Failed to load products:', error);
		}
		loading = false;
	}

	/** Append a new blank draft row to the bottom of the product table. */
	function addProductDraft() {
		const nextDraftId = `__draft_${++productDraftIdCounter}`;
		productDrafts = [...productDrafts, createBlankProductDraft(nextDraftId)];
	}

	/** Apply a partial field update to one unsaved draft row. */
	function updateProductDraft(draftId: string, patch: ProductDraftPatch) {
		productDrafts = productDrafts.map((draftProduct) =>
			draftProduct.id === draftId ? { ...draftProduct, ...patch } : draftProduct
		);
	}

	/** Remove an unsaved draft row without creating a real product. */
	function cancelProductDraft(draftId: string) {
		productDrafts = productDrafts.filter((draftProduct) => draftProduct.id !== draftId);
	}

	/**
	 * Save one unsaved draft row by handing it off to the existing optimistic create flow.
	 * The draft row disappears immediately and is replaced by a pending saved-product row.
	 */
	async function saveProductDraft(draftId: string) {
		const draftProduct = productDrafts.find((candidateDraft) => candidateDraft.id === draftId);
		if (!draftProduct) return;

		const trimmedName = draftProduct.name.trim();
		if (trimmedName.length < 3) return;

		const sku = generateProductSku(trimmedName);
		const facetValueIds = [
			...draftProduct.bitIds,
			...draftProduct.processIds,
			...draftProduct.allergenIds
		];

		const tempId = `__pending_${++pendingProductIdCounter}`;
		const optimisticProduct: SellerProduct = {
			id: tempId,
			name: trimmedName,
			variantId: '',
			sku,
			unitType: null,
			bits: rawBits.filter((bit) => draftProduct.bitIds.includes(bit.id)),
			processes: rawProcesses.filter((processItem) => draftProduct.processIds.includes(processItem.id)),
			allergenWarnings: rawAllergenWarnings.filter((allergen) =>
				draftProduct.allergenIds.includes(allergen.id)
			)
		};

		productDrafts = productDrafts.filter((candidateDraft) => candidateDraft.id !== draftId);
		products = [...products, optimisticProduct];
		pendingIds.add(tempId);

		try {
			const createdProduct = await createProduct({
				name: trimmedName,
				sku,
				facetValueIds: facetValueIds.length ? facetValueIds : undefined
			});
			products = products.map((product) => (product.id === tempId ? createdProduct : product));
			pendingIds.delete(tempId);
		} catch (error) {
			console.error('Failed to create product:', error);
			pendingIds.delete(tempId);
			failedIds.set(tempId, getErrorMessage(error, 'Failed to create product'));
		}
	}

	/** Create a new reusable bit and merge it into the local taxonomy cache. */
	async function handleCreateBit(name: string): Promise<InputSelectItem | null> {
		try {
			const newBit = await createBit({ name });
			if (!rawBits.some((existingBit) => existingBit.id === newBit.id)) {
				rawBits = [...rawBits, newBit];
			}
			return toItem(newBit);
		} catch (error) {
			console.error('Failed to create bit:', error);
			return null;
		}
	}

	/** Retry a failed optimistic create row with the same pending data. */
	function retryPendingProductCreate(tempId: string) {
		const product = products.find((candidateProduct) => candidateProduct.id === tempId);
		if (!product) return;

		failedIds.delete(tempId);
		pendingIds.add(tempId);

		const facetValueIds = [
			...product.bits.map((bit) => bit.id),
			...product.processes.map((processItem) => processItem.id),
			...product.allergenWarnings.map((allergen) => allergen.id)
		];

		void (async () => {
			try {
				const createdProduct = await createProduct({
					name: product.name,
					sku: product.sku || undefined,
					unitType: product.unitType || undefined,
					facetValueIds: facetValueIds.length ? facetValueIds : undefined
				});
				products = products.map((candidateProduct) =>
					candidateProduct.id === tempId ? createdProduct : candidateProduct
				);
				pendingIds.delete(tempId);
			} catch (error) {
				console.error('Failed to create product (retry):', error);
				pendingIds.delete(tempId);
				failedIds.set(tempId, getErrorMessage(error, 'Failed to create product'));
			}
		})();
	}

	/** Remove a failed optimistic create row from the table entirely. */
	function dismissFailedProductCreate(tempId: string) {
		products = products.filter((product) => product.id !== tempId);
		failedIds.delete(tempId);
	}

	/** Save inline edits for an existing persisted product row. */
	async function saveProductEdits(
		productId: string,
		edits: { name?: string; unitType?: string; facetValueIds?: string[] }
	) {
		const product = products.find((candidateProduct) => candidateProduct.id === productId);
		if (!product) return;

		const trimmedName = edits.name !== undefined ? edits.name.trim() : undefined;

		await updateProduct({
			id: product.id,
			variantId: product.variantId,
			...edits,
			...(trimmedName !== undefined ? { name: trimmedName } : {})
		});

		if (trimmedName !== undefined) product.name = trimmedName;
		if (edits.unitType !== undefined) product.unitType = edits.unitType || null;
		if (edits.facetValueIds) {
			product.bits = rawBits.filter((bit) => edits.facetValueIds!.includes(bit.id));
			product.processes = rawProcesses.filter((processItem) =>
				edits.facetValueIds!.includes(processItem.id)
			);
			product.allergenWarnings = rawAllergenWarnings.filter((allergen) =>
				edits.facetValueIds!.includes(allergen.id)
			);
		}
		products = [...products];
	}

	/** Delete an existing persisted product row. */
	async function deleteProductRow(productId: string) {
		await deleteRemoteProduct(productId);
		products = products.filter((product) => product.id !== productId);
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
		<div class="flex items-center gap-2">
			<h2 class="text-xl font-bold">Products</h2>

			<div class="ml-auto flex items-center gap-2">
				{#if products.length > 0 || productDrafts.length > 0}
					<TableDetailToggle bind:mode={metadataMode} />
				{/if}
				<TableEditModeToggle
					editMode={editMode}
					hasUnsavedChanges={hasUnsavedChanges}
					onchange={handleEditModeChange}
				/>
			</div>
		</div>

		{#key editSessionId}
			<ProductList
				{products}
				{productDrafts}
				{allBits}
				{allProcesses}
				{allAllergenWarnings}
				{metadataMode}
				{pendingIds}
				{failedIds}
				onsave={saveProductEdits}
				ondelete={deleteProductRow}
				onretry={retryPendingProductCreate}
				ondismiss={dismissFailedProductCreate}
				onupdateProductDraft={updateProductDraft}
				onsaveProductDraft={saveProductDraft}
				oncancelProductDraft={cancelProductDraft}
				onCreateBit={handleCreateBit}
			/>
		{/key}

		{#if editMode}
			<Button variant="outline" class="w-full" onclick={addProductDraft} data-testid="add-product-button">
				+ Add Product
			</Button>
		{/if}
	</div>
{/if}
