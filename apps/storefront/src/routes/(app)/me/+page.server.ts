import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { graphql } from '../../../graphql.js';

const ALL_SELLER_SLUGS_QUERY = graphql(`
	query AllSellerSlugs {
		sellers(activeOffersOnly: false) {
			slug
		}
	}
`);

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { customer } = await parent();
	const slug = customer.customFields?.seller?.customFields?.slug;
	if (slug) {
		redirect(303, `/${slug}`);
	}

	// Load all existing seller slugs for client-side availability checking
	const data = await locals.vendure.query(ALL_SELLER_SLUGS_QUERY);
	const takenSlugs = data.sellers.map((s) => s.slug);

	return { takenSlugs };
};
