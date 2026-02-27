import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, url }) => {
	const { customer } = await parent();

	if (!customer) {
		const returnTo = encodeURIComponent(url.pathname + url.search);
		redirect(303, `/login?returnTo=${returnTo}`);
	}

	return { customer };
};
