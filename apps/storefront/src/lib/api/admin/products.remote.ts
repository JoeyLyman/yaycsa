/**
 * Product management remote functions for sellers.
 *
 * All operations use the Admin API proxy (superadmin auth).
 * Seller identity verified from shop session. Ownership enforced via
 * Product.customFields.sellerId before every mutation.
 *
 * NOTE: Channel scoping via `vendure-token` is NOT used because Vendure's
 * SuperAdmin role is only authorized in the default channel. Instead, all
 * queries run against the default channel and filter by `sellerId`. Products
 * are assigned to both the seller's channel and the default channel via
 * explicit `assignProductsToChannel` mutations.
 */

import * as v from 'valibot';
import { query, command } from '$app/server';
import { adminQuery, adminMutate } from '../vendure-admin.js';
import { requireSellerContext, assertProductOwnedBySeller } from '../seller-context.js';

// ─── Admin API GraphQL queries (raw strings — no gql.tada for Admin API yet) ───

const PRODUCTS_QUERY = `
	query Products {
		products(options: { take: 500 }) {
			items {
				id
				name
				slug
				customFields {
					sellerId
				}
				facetValues {
					id
					code
					name
					facet { code }
					customFields { group }
				}
				variants {
					id
					name
					sku
					customFields {
						unitType
					}
				}
			}
			totalItems
		}
	}
`;

const CREATE_PRODUCT_MUTATION = `
	mutation CreateProduct($input: CreateProductInput!) {
		createProduct(input: $input) {
			id
			name
			slug
		}
	}
`;

const CREATE_PRODUCT_VARIANTS_MUTATION = `
	mutation CreateProductVariants($input: [CreateProductVariantInput!]!) {
		createProductVariants(input: $input) {
			id
			name
			sku
			customFields {
				unitType
			}
		}
	}
`;

const UPDATE_PRODUCT_MUTATION = `
	mutation UpdateProduct($input: UpdateProductInput!) {
		updateProduct(input: $input) {
			id
			name
			slug
		}
	}
`;

const UPDATE_PRODUCT_VARIANTS_MUTATION = `
	mutation UpdateProductVariants($input: [UpdateProductVariantInput!]!) {
		updateProductVariants(input: $input) {
			id
			name
			sku
			customFields {
				unitType
			}
		}
	}
`;

const DELETE_PRODUCT_MUTATION = `
	mutation DeleteProduct($id: ID!) {
		deleteProduct(id: $id) {
			result
			message
		}
	}
`;

// ─── Type definitions for Admin API responses ───

/** A facet value as returned by the Admin API. */
interface AdminFacetValue {
	id: string;
	code: string;
	name: string;
	facet: { code: string };
	customFields: { group: string | null };
}

interface AdminProduct {
	id: string;
	name: string;
	slug: string;
	customFields: { sellerId: number | null };
	facetValues: AdminFacetValue[];
	variants: Array<{
		id: string;
		name: string;
		sku: string;
		customFields: { unitType: string | null };
	}>;
}

/** A facet value exposed to the UI (bits, process, or allergen-warning). */
export interface FacetValueInfo {
	id: string;
	code: string;
	name: string;
	/** Food group — only set on "bits" facet values. */
	group: string | null;
}

/** Simplified product type returned to the UI. */
export interface SellerProduct {
	id: string;
	name: string;
	variantId: string;
	sku: string;
	unitType: string | null;
	/** Exhaustive list of ingredients/components ("bits"). */
	bits: FacetValueInfo[];
	/** Processing types applied to this product. */
	processes: FacetValueInfo[];
	/** Allergen cross-contamination warnings. */
	allergenWarnings: FacetValueInfo[];
}

// ─── Helpers ───

/**
 * Generate a URL-friendly slug from a product name.
 * E.g., "Mixed Salad Greens" → "mixed-salad-greens"
 */
function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Generate a SKU from a product name.
 * E.g., "Mixed Salad Greens" → "MIXED-SALAD-GREENS"
 * Only used on create — never auto-updated on rename.
 */
function generateSku(name: string): string {
	return name
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Map an Admin API FacetValue to the simplified UI type. */
function toFacetValueInfo(fv: AdminFacetValue): FacetValueInfo {
	return { id: fv.id, code: fv.code, name: fv.name, group: fv.customFields?.group ?? null };
}

/**
 * Map Admin API product to simplified seller product.
 * Assumes one product = one variant (wholesale simplification).
 * Splits facet values into bits, processes, and allergen warnings by facet code.
 */
function toSellerProduct(product: AdminProduct): SellerProduct {
	const variant = product.variants[0];
	const fvs = product.facetValues ?? [];
	return {
		id: product.id,
		name: product.name,
		variantId: variant?.id ?? '',
		sku: variant?.sku ?? '',
		unitType: variant?.customFields?.unitType ?? null,
		bits: fvs.filter((fv) => fv.facet.code === 'bits').map(toFacetValueInfo),
		processes: fvs.filter((fv) => fv.facet.code === 'process').map(toFacetValueInfo),
		allergenWarnings: fvs.filter((fv) => fv.facet.code === 'allergen-warning').map(toFacetValueInfo),
	};
}

// ─── Remote functions ───

/**
 * Fetch all products owned by the current seller.
 * Filtered by sellerId — the authoritative ownership field.
 */
export const myProducts = query(async (): Promise<SellerProduct[]> => {
	const { sellerId } = await requireSellerContext();

	const data = await adminQuery<{
		products: { items: AdminProduct[]; totalItems: number };
	}>(PRODUCTS_QUERY);

	return data.products.items
		.filter((p) => p.customFields.sellerId === sellerId)
		.map(toSellerProduct);
});

/**
 * Create a new product with a single variant.
 *
 * Two-step Vendure process:
 * 1. createProduct — sets name, slug, sellerId
 * 2. createProductVariants — sets sku, unitType
 *
 * Also assigns the product to the seller's channel for channel-based visibility.
 * Rolls back (deletes) the product if variant creation fails.
 */
export const createProduct = command(
	v.object({
		name: v.pipe(
			v.string(),
			v.nonEmpty('Product name is required'),
			v.minLength(2, 'Name must be at least 2 characters'),
			v.maxLength(255),
		),
		sku: v.optional(v.pipe(v.string(), v.maxLength(100))),
		unitType: v.optional(v.string()),
		/** FacetValue IDs for bits (ingredients), process types, and allergen warnings. */
		facetValueIds: v.optional(v.array(v.string())),
	}),
	async ({ name, sku, unitType, facetValueIds }) => {
		const { sellerId } = await requireSellerContext();

		const slug = slugify(name);
		const finalSku = sku?.trim() || generateSku(name);

		// Step 1: Create the product with ownership (in default channel)
		const createData = await adminMutate<{
			createProduct: { id: string; name: string; slug: string };
		}>(
			CREATE_PRODUCT_MUTATION,
			{
				input: {
					translations: [
						{
							languageCode: 'en',
							name,
							slug,
							description: '',
						},
					],
					customFields: { sellerId },
					...(facetValueIds?.length ? { facetValueIds } : {}),
				},
			},
		);

		const productId = createData.createProduct.id;

		// Step 2: Create a single variant
		try {
			await adminMutate(
				CREATE_PRODUCT_VARIANTS_MUTATION,
				{
					input: [
						{
							productId,
							translations: [{ languageCode: 'en', name }],
							sku: finalSku,
							price: 0,
							customFields: unitType ? { unitType } : {},
						},
					],
				},
			);
		} catch (err) {
			// Rollback: delete the orphaned product
			try {
				await adminMutate(DELETE_PRODUCT_MUTATION, { id: productId });
			} catch {
				console.error(`Failed to rollback orphaned product ${productId}`);
			}
			throw err;
		}

		// NOTE: Channel assignment skipped. SuperAdmin is only authorized in the
		// default channel — assignProductsToChannel to a seller channel triggers
		// FORBIDDEN. Products are discoverable via sellerId filtering instead.

		// Fetch the created product to return full data (including server-generated variant ID + facets)
		const productData = await adminQuery<{
			product: AdminProduct;
		}>(`query ($id: ID!) {
			product(id: $id) {
				id name slug
				customFields { sellerId }
				facetValues { id code name facet { code } customFields { group } }
				variants { id name sku customFields { unitType } }
			}
		}`, { id: productId });

		return toSellerProduct(productData.product);
	},
);

/**
 * Update a product's name, SKU, or unit type.
 * Ownership-verified before mutation. Strips sellerId from input.
 */
export const updateProduct = command(
	v.object({
		id: v.string(),
		variantId: v.string(),
		name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(255))),
		sku: v.optional(v.pipe(v.string(), v.maxLength(100))),
		unitType: v.optional(v.string()),
		/** Full replacement set of FacetValue IDs (bits + process + allergen-warning). */
		facetValueIds: v.optional(v.array(v.string())),
	}),
	async ({ id, variantId, name, sku, unitType, facetValueIds }) => {
		const { sellerId } = await requireSellerContext();

		// Ownership check — throws 403 if not owned
		await assertProductOwnedBySeller(id, sellerId);

		// Update product-level fields (name, facet values)
		if (name !== undefined || facetValueIds !== undefined) {
			const productInput: Record<string, unknown> = { id };
			if (name !== undefined) {
				productInput.translations = [{ languageCode: 'en', name, slug: slugify(name), description: '' }];
			}
			if (facetValueIds !== undefined) {
				productInput.facetValueIds = facetValueIds;
			}
			await adminMutate(
				UPDATE_PRODUCT_MUTATION,
				{ input: productInput },
			);
		}

		// Also update variant name to match product name (one product = one variant)
		if (name !== undefined) {
			await adminMutate(
				UPDATE_PRODUCT_VARIANTS_MUTATION,
				{
					input: [
						{
							id: variantId,
							translations: [{ languageCode: 'en', name }],
						},
					],
				},
			);
		}

		// Update variant fields if provided
		if (sku !== undefined || unitType !== undefined) {
			const variantInput: Record<string, unknown> = { id: variantId };
			if (sku !== undefined) variantInput.sku = sku;
			if (unitType !== undefined) variantInput.customFields = { unitType };

			await adminMutate(
				UPDATE_PRODUCT_VARIANTS_MUTATION,
				{ input: [variantInput] },
			);
		}

		return { success: true as const };
	},
);

// ─── Facet query helpers ───

const FACETS_QUERY = `
	query Facet($options: FacetListOptions) {
		facets(options: $options) {
			items {
				id
				code
				name
				values {
					id
					code
					name
					customFields { group }
				}
			}
		}
	}
`;

interface AdminFacet {
	id: string;
	code: string;
	name: string;
	values: Array<{
		id: string;
		code: string;
		name: string;
		customFields: { group: string | null };
	}>;
}

/**
 * Fetch all FacetValues for a given facet code.
 * Used to populate bits, process, and allergen-warning dropdowns.
 */
async function fetchFacetValues(facetCode: string): Promise<FacetValueInfo[]> {
	const data = await adminQuery<{ facets: { items: AdminFacet[] } }>(
		FACETS_QUERY,
		{ options: { filter: { code: { eq: facetCode } } } },
	);

	const facet = data.facets.items[0];
	if (!facet) return [];

	return facet.values.map((v) => ({
		id: v.id,
		code: v.code,
		name: v.name,
		group: v.customFields?.group ?? null,
	}));
}

/**
 * Fetch all available bits (ingredients/components).
 * Each bit has a `group` field for food group membership (Vegetables, Dairy, etc.).
 */
export const fetchBits = query(async (): Promise<FacetValueInfo[]> => {
	return fetchFacetValues('bits');
});

/**
 * Fetch all available processing types (raw, frozen, fermented, etc.).
 */
export const fetchProcessTypes = query(async (): Promise<FacetValueInfo[]> => {
	return fetchFacetValues('process');
});

/**
 * Fetch all available allergen warnings (FDA Big 9 cross-contamination).
 */
export const fetchAllergenWarnings = query(async (): Promise<FacetValueInfo[]> => {
	return fetchFacetValues('allergen-warning');
});

// ─── Create custom bit (ingredient) ───

const CREATE_FACET_VALUES_MUTATION = `
	mutation CreateFacetValues($input: [CreateFacetValueInput!]!) {
		createFacetValues(input: $input) {
			id
			code
			name
			customFields { group }
		}
	}
`;

/**
 * Normalize a bit name to Title Case, letters/numbers/spaces/ampersands only.
 * E.g., "lime leaves" → "Lime Leaves", "chili-flakes!!" → "Chili Flakes"
 */
function normalizeBitName(raw: string): string {
	return raw
		.replace(/[^a-zA-Z0-9\s&]/g, ' ')  // strip symbols except &
		.replace(/\s+/g, ' ')                // collapse whitespace
		.trim()
		.split(' ')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
}

/**
 * Create a new bit (ingredient) FacetValue under the `bits` facet.
 * Sellers can add custom ingredients that aren't in the seeded taxonomy.
 * Name is normalized to Title Case with symbols stripped.
 * The new bit has no food group (null) — admins can curate groupings later.
 */
export const createBit = command(
	v.object({
		name: v.pipe(
			v.string(),
			v.nonEmpty('Ingredient name is required'),
			v.minLength(2, 'Name must be at least 2 characters'),
			v.maxLength(100),
		),
	}),
	async ({ name: rawName }): Promise<FacetValueInfo> => {
		const name = normalizeBitName(rawName);
		if (name.length < 2) throw new Error('Ingredient name too short after cleanup');

		// Must be a seller to create bits
		await requireSellerContext();

		// Find the bits facet and check for existing duplicate
		const facetData = await adminQuery<{ facets: { items: AdminFacet[] } }>(
			FACETS_QUERY,
			{ options: { filter: { code: { eq: 'bits' } } } },
		);
		const bitsFacet = facetData.facets.items[0];
		if (!bitsFacet) throw new Error('Bits facet not found — run seed-taxonomy first');

		// Check for existing value with same name (case-insensitive)
		const existing = bitsFacet.values.find(
			(v) => v.name.toLowerCase() === name.toLowerCase(),
		);
		if (existing) {
			return {
				id: existing.id,
				code: existing.code,
				name: existing.name,
				group: existing.customFields?.group ?? null,
			};
		}

		const code = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');

		const data = await adminMutate<{
			createFacetValues: Array<{
				id: string;
				code: string;
				name: string;
				customFields: { group: string | null };
			}>;
		}>(CREATE_FACET_VALUES_MUTATION, {
			input: [
				{
					facetId: bitsFacet.id,
					code,
					translations: [{ languageCode: 'en', name }],
					customFields: {},
				},
			],
		});

		const created = data.createFacetValues[0];
		return {
			id: created.id,
			code: created.code,
			name: created.name,
			group: created.customFields?.group ?? null,
		};
	},
);

// ─── Delete ───

export const deleteProduct = command(v.string(), async (id) => {
	const { sellerId } = await requireSellerContext();

	// Ownership check — throws 403 if not owned
	await assertProductOwnedBySeller(id, sellerId);

	const data = await adminMutate<{
		deleteProduct: { result: string; message: string };
	}>(DELETE_PRODUCT_MUTATION, { id });

	if (data.deleteProduct.result !== 'DELETED') {
		throw new Error(data.deleteProduct.message || 'Failed to delete product');
	}

	return { success: true as const };
});
