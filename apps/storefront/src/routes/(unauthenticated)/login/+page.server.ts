import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { graphql } from '../../../graphql';

const ACTIVE_CUSTOMER_QUERY = graphql(`
	query ActiveCustomerLoginCheck {
		activeCustomer {
			id
		}
	}
`);

export const load: PageServerLoad = async ({ locals }) => {
	const data = await locals.vendure.query(ACTIVE_CUSTOMER_QUERY);
	if (data.activeCustomer) {
		redirect(303, '/');
	}
};
