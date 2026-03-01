import * as v from 'valibot';
import { query, getRequestEvent } from '$app/server';
import { graphql } from '../../../graphql.js';

const SELLERS_QUERY = graphql(`
	query Sellers($activeOffersOnly: Boolean) {
		sellers(activeOffersOnly: $activeOffersOnly) {
			id
			name
			slug
		}
	}
`);

const SELLER_BY_SLUG_QUERY = graphql(`
	query SellerBySlug($slug: String!) {
		sellerBySlug(slug: $slug) {
			id
			name
			slug
		}
	}
`);

export const sellers = query(
	v.optional(v.object({ activeOffersOnly: v.optional(v.boolean()) })),
	async (args) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.query(SELLERS_QUERY, {
			activeOffersOnly: args?.activeOffersOnly ?? true,
		});
		return data.sellers;
	}
);

export const sellerBySlug = query(v.string(), async (slug) => {
	const event = getRequestEvent();
	const data = await event.locals.vendure.query(SELLER_BY_SLUG_QUERY, { slug });
	return data.sellerBySlug ?? null;
});
