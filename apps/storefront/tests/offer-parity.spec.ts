/**
 * Offer parity test — the data contract behind the shared `offer-list` table.
 *
 * The admin offers workspace renders "Customer view" from admin-sourced data
 * (a single fetch) rather than re-fetching the Shop API. That only stays honest
 * if, for the same offer, the admin query and the Shop `activeOffers` query
 * produce an identical BUYER-FACING view once normalized. This test asserts
 * exactly that against the seeded seller's real offers from both APIs, so any
 * drift between the two GraphQL queries (or the two normalizers) fails loudly.
 *
 * Requires both servers running (Vendure on :3000, per the suite convention).
 */

import { test, expect } from '@playwright/test';
import { getAdminToken } from './setup/seller-helpers';
import {
	buyerFacingOfferView,
	normalizeAdminOffer,
	normalizeShopOffer,
	type RawOffer
} from '../src/lib/components/bundles/offer-list/offer-list-helpers';

const SHOP_API = 'http://localhost:3000/shop-api';
const ADMIN_API = 'http://localhost:3000/admin-api';

/** Defaults to GTF (seeded with an active offer) — override via TEST_SELLER_SLUG. */
const SELLER_SLUG = process.env.TEST_SELLER_SLUG ?? 'gathering-together-farm';

/** Shared line-item + fulfillment-option field selection used by both queries. */
const OFFER_FIELDS = `
	id
	seller { id name }
	validFrom
	validUntil
	allowLateOrders
	notes
	fulfillmentOptions {
		id
		name
		type
		notes
		fulfillmentWeekday
		fulfillmentTimeWindowStart
		fulfillmentTimeWindowEnd
		orderDeadlineWeekday
		orderDeadlineTime
	}
	lineItems {
		id
		productVariant { id name sku customFields { unitType } }
		price
		priceIncludesTax
		pricingMode
		priceTiers
		quantityLimitMode
		quantityLimit
		quantityOrdered
		quantityRemaining
		autoConfirm
		notes
		sortOrder
	}
`;

/** POST a GraphQL request, failing loudly on transport or GraphQL errors. */
async function graphqlRequest<T>(
	endpoint: string,
	query: string,
	variables: Record<string, unknown>,
	headers: Record<string, string> = {}
): Promise<T> {
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify({ query, variables })
	});
	const body = await res.json();
	if (body.errors?.length) {
		throw new Error(`GraphQL error from ${endpoint}: ${JSON.stringify(body.errors)}`);
	}
	return body.data as T;
}

test.describe('offer customer/admin data parity', () => {
	test('buyer-facing view is identical from Shop API and Admin API', async () => {
		// Resolve the seeded seller's id from its public slug.
		const { sellerBySlug } = await graphqlRequest<{ sellerBySlug: { id: string } | null }>(
			SHOP_API,
			`query($slug: String!) { sellerBySlug(slug: $slug) { id } }`,
			{ slug: SELLER_SLUG }
		);
		expect(sellerBySlug, `seller "${SELLER_SLUG}" should exist`).not.toBeNull();
		const sellerId = sellerBySlug!.id;

		// Customer lens: what buyers actually receive from the Shop API.
		const shopData = await graphqlRequest<{ activeOffers: RawOffer[] }>(
			SHOP_API,
			`query($sellerId: ID) { activeOffers(sellerId: $sellerId) { ${OFFER_FIELDS} } }`,
			{ sellerId }
		);
		const shopOffers = shopData.activeOffers;
		expect(
			shopOffers.length,
			`seller "${SELLER_SLUG}" should have at least one active offer seeded`
		).toBeGreaterThan(0);

		// Admin lens: the same offers via the Admin proxy (returns all statuses).
		const adminToken = await getAdminToken();
		const adminData = await graphqlRequest<{ offers: { items: RawOffer[] } }>(
			ADMIN_API,
			`query($sellerId: ID!) { offers(sellerId: $sellerId, options: { take: 500 }) { items { ${OFFER_FIELDS} } } }`,
			{ sellerId },
			{ Authorization: `Bearer ${adminToken}` }
		);
		const adminOffersById = new Map(
			adminData.offers.items.map((offer) => [offer.id, offer])
		);

		// Every active (customer-visible) offer must exist admin-side and, once
		// normalized, present an identical buyer-facing view.
		for (const shopOffer of shopOffers) {
			const adminOffer = adminOffersById.get(shopOffer.id);
			expect(adminOffer, `offer ${shopOffer.id} should be visible via the Admin API`).toBeTruthy();

			const shopView = buyerFacingOfferView(normalizeShopOffer(shopOffer));
			const adminView = buyerFacingOfferView(normalizeAdminOffer(adminOffer!));

			expect(adminView, `offer ${shopOffer.id} buyer-facing view should match`).toEqual(shopView);
		}
	});
});
