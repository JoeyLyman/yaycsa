import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { graphql } from '../../../graphql';

const SELLER_BY_SLUG_QUERY = graphql(`
	query SellerBySlugLayout($slug: String!) {
		sellerBySlug(slug: $slug) {
			id
			name
			slug
		}
	}
`);

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const data = await locals.vendure.query(SELLER_BY_SLUG_QUERY, { slug: params.seller });
	const seller = data.sellerBySlug;

	if (!seller) {
		error(404, { message: 'Seller not found' });
	}

	return { seller };
};
