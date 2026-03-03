import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { customer } = await parent();
	const slug = customer.customFields?.seller?.customFields?.slug;
	if (slug) {
		redirect(303, `/${slug}`);
	}
	redirect(303, '/me/account');
};
