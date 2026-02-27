import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return { error: 'No reset token provided', token: null };
	}

	return { error: null, token };
};
