import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { graphql, readFragment } from '../../graphql';
import { ActiveCustomerFields } from '$lib/api/shop/fragments';

const ACTIVE_CUSTOMER_QUERY = graphql(
	`
		query ActiveCustomerLayout {
			activeCustomer {
				...ActiveCustomerFields
			}
		}
	`,
	[ActiveCustomerFields]
);

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const data = await locals.vendure.query(ACTIVE_CUSTOMER_QUERY);
	const customer = data.activeCustomer ? readFragment(ActiveCustomerFields, data.activeCustomer) : null;

	if (!customer) {
		const returnTo = encodeURIComponent(url.pathname + url.search);
		redirect(303, `/login?returnTo=${returnTo}`);
	}

	return { customer };
};
