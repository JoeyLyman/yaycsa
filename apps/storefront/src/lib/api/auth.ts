import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

const COOKIE_NAME = 'vendure_auth_token';

export function getAuthToken(cookies: Cookies): string | undefined {
	return cookies.get(COOKIE_NAME);
}

export function setAuthToken(cookies: Cookies, token: string): void {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 60 * 24 * 365 // 1 year
	});
}

export function removeAuthToken(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}
