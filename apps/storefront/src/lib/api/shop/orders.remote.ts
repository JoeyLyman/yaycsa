import * as v from 'valibot';
import { query, command, getRequestEvent } from '$app/server';
import { graphql } from '../../../graphql.js';

const ACTIVE_ORDER_QUERY = graphql(`
	query ActiveOrder {
		activeOrder {
			id
			code
			state
			totalWithTax
			totalQuantity
			lines {
				id
				quantity
				linePriceWithTax
				productVariant {
					id
					name
					sku
					customFields {
						unitType
					}
				}
				customFields {
					lineStatus
					buyerNotes
				}
			}
		}
	}
`);

const ADD_OFFER_ITEM_MUTATION = graphql(`
	mutation AddOfferItemToOrder(
		$offerLineItemId: ID!
		$quantity: Int!
		$selectedCaseQuantity: Int
		$buyerNotes: String
	) {
		addOfferItemToOrder(
			offerLineItemId: $offerLineItemId
			quantity: $quantity
			selectedCaseQuantity: $selectedCaseQuantity
			buyerNotes: $buyerNotes
		) {
			id
			code
			totalWithTax
			totalQuantity
		}
	}
`);

const ADJUST_OFFER_ITEM_MUTATION = graphql(`
	mutation AdjustOfferItemQuantity($orderLineId: ID!, $quantity: Int!) {
		adjustOfferItemQuantity(orderLineId: $orderLineId, quantity: $quantity) {
			id
			code
			totalWithTax
			totalQuantity
		}
	}
`);

export const activeOrder = query(async () => {
	const event = getRequestEvent();
	const data = await event.locals.vendure.query(ACTIVE_ORDER_QUERY);
	return data.activeOrder ?? null;
});

export const addOfferItemToOrder = command(
	v.object({
		offerLineItemId: v.pipe(v.string(), v.nonEmpty()),
		quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
		selectedCaseQuantity: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
		buyerNotes: v.optional(v.string())
	}),
	async (input) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(ADD_OFFER_ITEM_MUTATION, input);
		return data.addOfferItemToOrder;
	}
);

export const adjustOfferItemQuantity = command(
	v.object({
		orderLineId: v.pipe(v.string(), v.nonEmpty()),
		quantity: v.pipe(v.number(), v.integer(), v.minValue(1))
	}),
	async (input) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(ADJUST_OFFER_ITEM_MUTATION, input);
		return data.adjustOfferItemQuantity;
	}
);
