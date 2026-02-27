import type { Handle } from '@sveltejs/kit';
import { createVendureClient } from '$lib/api/vendure';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.vendure = createVendureClient(event.cookies);
	return resolve(event);
};
