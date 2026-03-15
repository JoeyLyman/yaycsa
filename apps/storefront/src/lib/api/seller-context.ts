/**
 * Seller context helper for proxy authorization.
 *
 * Used by all seller remote functions to:
 * 1. Verify the authenticated customer is a seller
 * 2. Resolve the seller's actual channel token
 * 3. Assert ownership of specific entities before mutations
 *
 * INVARIANT: Seller slug === Channel code. Enforced in becomeSeller
 * (marketplace.service.ts line 194). Slugs are immutable after creation.
 */

import { error, redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { graphql, readFragment } from '../../graphql.js';
import { ActiveCustomerFields } from './shop/fragments.js';
import { adminQuery } from './vendure-admin.js';

/** Query activeCustomer with seller relation via Shop API. */
const ACTIVE_CUSTOMER_WITH_SELLER = graphql(
	`
		query ActiveCustomerWithSeller {
			activeCustomer {
				...ActiveCustomerFields
			}
		}
	`,
	[ActiveCustomerFields]
);

/** Admin API query to look up a channel's token from its code. */
const CHANNEL_BY_CODE_QUERY = `
	query ChannelByCode($code: String!) {
		channels(options: { filter: { code: { eq: $code } } }) {
			items {
				id
				token
			}
		}
	}
`;

/** Admin API query to check product ownership via sellerId custom field. */
const PRODUCT_SELLER_CHECK_QUERY = `
	query ProductSellerCheck($id: ID!) {
		product(id: $id) {
			id
			customFields {
				sellerId
			}
		}
	}
`;

export interface SellerContext {
	/** Numeric seller ID — matches Product.customFields.sellerId (int). */
	sellerId: number;
	/** Seller's URL slug. */
	sellerSlug: string;
	/** Actual Vendure channel token (hex string) for vendure-token header. */
	channelToken: string;
}

/**
 * Cached slug → channelToken mapping.
 * Channel tokens don't change, so this is safe to cache indefinitely.
 * On channel lookup failure (e.g., after a deploy with stale cache), the
 * cache miss triggers a fresh lookup.
 */
const channelTokenCache = new Map<string, string>();

/**
 * Resolve a channel's actual token from its code (slug).
 * Uses Admin API query, cached in memory.
 */
async function resolveChannelToken(channelCode: string): Promise<string> {
	const cached = channelTokenCache.get(channelCode);
	if (cached) return cached;

	const data = await adminQuery<{
		channels: { items: Array<{ id: string; token: string }> };
	}>(CHANNEL_BY_CODE_QUERY, { code: channelCode });

	const token = data.channels.items[0]?.token;
	if (!token) {
		throw error(500, `Channel not found for code: ${channelCode}`);
	}

	channelTokenCache.set(channelCode, token);
	return token;
}

/**
 * Verify the current request is from an authenticated seller.
 * Returns the seller's ID, slug, and channel token.
 *
 * Throws redirect to /login if not authenticated.
 * Throws redirect to /me if not a seller.
 */
export async function requireSellerContext(): Promise<SellerContext> {
	const event = getRequestEvent();
	const data = await event.locals.vendure.query(ACTIVE_CUSTOMER_WITH_SELLER);
	const customer = data.activeCustomer
		? readFragment(ActiveCustomerFields, data.activeCustomer)
		: null;

	if (!customer) {
		throw redirect(302, '/login');
	}

	const seller = customer.customFields?.seller;
	if (!seller) {
		throw redirect(302, '/me');
	}

	const slug = seller.customFields?.slug;
	if (!slug) {
		throw error(500, 'Seller has no slug configured');
	}

	const channelToken = await resolveChannelToken(slug);

	return {
		sellerId: Number(seller.id),
		sellerSlug: slug,
		channelToken,
	};
}

/**
 * Assert that a product is owned by the given seller.
 * Queries the product via Admin API and checks customFields.sellerId.
 *
 * @throws 403 if the product doesn't belong to the seller
 * @throws 404 if the product doesn't exist
 */
export async function assertProductOwnedBySeller(
	productId: string,
	sellerId: number,
): Promise<void> {
	const data = await adminQuery<{
		product: { id: string; customFields: { sellerId: number | null } } | null;
	}>(PRODUCT_SELLER_CHECK_QUERY, { id: productId });

	if (!data.product) {
		throw error(404, 'Product not found');
	}

	if (data.product.customFields.sellerId !== sellerId) {
		throw error(403, 'Product does not belong to this seller');
	}
}
