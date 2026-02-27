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

export const load: LayoutServerLoad = async ({ locals }) => {
	const data = await locals.vendure.query(ACTIVE_CUSTOMER_QUERY);
	const customer = data.activeCustomer ? readFragment(ActiveCustomerFields, data.activeCustomer) : null;
	return { customer };
};
