import * as v from 'valibot';
import { query, getRequestEvent } from '$app/server';
import { graphql } from '../../../graphql.js';

const ACTIVE_OFFERS_QUERY = graphql(`
	query ActiveOffers($sellerId: ID) {
		activeOffers(sellerId: $sellerId) {
			id
			createdAt
			updatedAt
			seller {
				id
				name
			}
			status
			validFrom
			validUntil
			allowLateOrders
			notes
			fulfillmentOptions {
				id
				code
				name
				type
				description
				active
				recurrence
				fulfillmentStartDate
				fulfillmentEndDate
				deadlineOffsetHours
			}
			lineItems {
				id
				productVariant {
					id
					name
					sku
					customFields {
						unitType
					}
				}
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
		}
	}
`);

const OFFER_LINE_ITEM_QUERY = graphql(`
	query OfferLineItem($id: ID!) {
		offerLineItem(id: $id) {
			id
			productVariant {
				id
				name
				sku
				customFields {
					unitType
				}
			}
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
	}
`);

export const activeOffers = query(
	v.optional(v.object({ sellerId: v.optional(v.string()) })),
	async (args) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.query(ACTIVE_OFFERS_QUERY, {
			sellerId: args?.sellerId ?? null
		});
		return data.activeOffers;
	}
);

export const offerLineItem = query(v.string(), async (id) => {
	const event = getRequestEvent();
	const data = await event.locals.vendure.query(OFFER_LINE_ITEM_QUERY, { id });
	return data.offerLineItem ?? null;
});
