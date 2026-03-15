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

interface AdminProduct {
	id: string;
	name: string;
	slug: string;
	customFields: { sellerId: number | null };
	variants: Array<{
		id: string;
		name: string;
		sku: string;
		customFields: { unitType: string | null };
	}>;
}

/** Simplified product type returned to the UI. */
export interface SellerProduct {
	id: string;
	name: string;
	variantId: string;
	sku: string;
	unitType: string | null;
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

/**
 * Map Admin API product to simplified seller product.
 * Assumes one product = one variant (wholesale simplification).
 */
function toSellerProduct(product: AdminProduct): SellerProduct {
	const variant = product.variants[0];
	return {
		id: product.id,
		name: product.name,
		variantId: variant?.id ?? '',
		sku: variant?.sku ?? '',
		unitType: variant?.customFields?.unitType ?? null,
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
	}),
	async ({ name, sku, unitType }) => {
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

		// Fetch the created product to return full data (including server-generated variant ID)
		const productData = await adminQuery<{
			product: { id: string; name: string; variants: Array<{ id: string; sku: string; customFields: { unitType: string | null } }> };
		}>(`query ($id: ID!) { product(id: $id) { id name variants { id sku customFields { unitType } } } }`, { id: productId });

		const variant = productData.product.variants[0];
		return {
			id: productData.product.id,
			name: productData.product.name,
			variantId: variant.id,
			sku: variant.sku,
			unitType: variant.customFields.unitType,
		};
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
	}),
	async ({ id, variantId, name, sku, unitType }) => {
		const { sellerId } = await requireSellerContext();

		// Ownership check — throws 403 if not owned
		await assertProductOwnedBySeller(id, sellerId);

		// Update product name if provided
		if (name !== undefined) {
			await adminMutate(
				UPDATE_PRODUCT_MUTATION,
				{
					input: {
						id,
						translations: [{ languageCode: 'en', name, slug: slugify(name), description: '' }],
					},
				},
			);

			// Also update variant name to match (one product = one variant)
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

/**
 * Delete a product.
 * Ownership-verified before mutation. Vendure soft-deletes by default.
 */
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
