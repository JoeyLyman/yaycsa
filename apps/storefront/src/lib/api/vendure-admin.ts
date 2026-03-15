/**
 * Server-side Admin API client for seller proxy operations.
 *
 * Authenticates as superadmin and caches the session token in memory.
 * Each request can be scoped to a seller's channel via the `channelToken` parameter.
 *
 * SECURITY: This module is server-side only. Never import from client-side code.
 * The superadmin token never reaches the browser. All seller authorization
 * is enforced by the calling remote functions (via requireSellerContext + ownership checks).
 */

const ADMIN_API_URL = 'http://localhost:3000/admin-api';
const ADMIN_USERNAME = process.env.VENDURE_ADMIN_USERNAME ?? 'superadmin';
const ADMIN_PASSWORD = process.env.VENDURE_ADMIN_PASSWORD ?? 'superadmin';

/** Cached superadmin session token. */
let cachedToken: string | null = null;

/** In-flight auth promise for single-flight refresh. */
let refreshPromise: Promise<string> | null = null;

/**
 * Authenticate to Admin API and return a session token.
 * Uses Vendure's native authentication strategy.
 */
async function authenticate(): Promise<string> {
	const res = await fetch(ADMIN_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			query: `
				mutation Login($username: String!, $password: String!) {
					login(username: $username, password: $password) {
						... on CurrentUser { id }
						... on InvalidCredentialsError { errorCode message }
						... on NativeAuthStrategyError { errorCode message }
					}
				}
			`,
			variables: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
		})
	});

	const token = res.headers.get('vendure-auth-token');
	if (!token) {
		const json = await res.json();
		const result = json?.data?.login;
		if (result?.errorCode) {
			throw new Error(`Admin API auth failed: ${result.message}`);
		}
		throw new Error('Admin API auth failed: no token in response');
	}

	return token;
}

/**
 * Get a valid superadmin token, authenticating if needed.
 * Uses single-flight pattern to avoid thundering herd on concurrent requests.
 */
async function getValidToken(): Promise<string> {
	if (cachedToken) return cachedToken;
	if (refreshPromise) return refreshPromise;

	refreshPromise = authenticate()
		.then((token) => {
			cachedToken = token;
			refreshPromise = null;
			return token;
		})
		.catch((err) => {
			refreshPromise = null;
			throw err;
		});

	return refreshPromise;
}

/**
 * Invalidate the cached token and force re-authentication.
 * Returns a promise that resolves to a fresh token.
 * Uses the same single-flight lock as getValidToken() to prevent
 * concurrent FORBIDDEN retries from triggering multiple re-auths.
 */
function invalidateAndRefresh(): Promise<string> {
	cachedToken = null;
	// If a refresh is already in flight (from another concurrent FORBIDDEN),
	// piggyback on it instead of starting a second auth.
	if (refreshPromise) return refreshPromise;

	refreshPromise = authenticate()
		.then((token) => {
			cachedToken = token;
			refreshPromise = null;
			return token;
		})
		.catch((err) => {
			refreshPromise = null;
			throw err;
		});

	return refreshPromise;
}

/**
 * Execute a GraphQL request against the Admin API as superadmin.
 *
 * @param query - Raw GraphQL query string
 * @param variables - Query variables
 * @param channelToken - Optional channel token to scope the request to a seller's channel
 * @returns The `data` portion of the GraphQL response, typed as T
 */
async function adminRequest<T>(
	query: string,
	variables?: Record<string, unknown>,
	channelToken?: string
): Promise<T> {
	const token = await getValidToken();

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`
	};

	if (channelToken) {
		headers['vendure-token'] = channelToken;
	}

	const res = await fetch(ADMIN_API_URL, {
		method: 'POST',
		headers,
		body: JSON.stringify({ query, variables: variables ?? undefined })
	});

	// Capture rotated token if Vendure sends one
	const responseToken = res.headers.get('vendure-auth-token');
	if (responseToken) {
		cachedToken = responseToken;
	}

	const json = (await res.json()) as {
		data?: T;
		errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
	};

	// Handle auth errors — invalidate token and retry once
	if (json.errors?.some((e) => e.extensions?.code === 'FORBIDDEN' || e.message.includes('not authenticated'))) {
		const freshToken = await invalidateAndRefresh();

		const retryHeaders: Record<string, string> = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${freshToken}`
		};
		if (channelToken) {
			retryHeaders['vendure-token'] = channelToken;
		}

		const retryRes = await fetch(ADMIN_API_URL, {
			method: 'POST',
			headers: retryHeaders,
			body: JSON.stringify({ query, variables: variables ?? undefined })
		});

		const retryResponseToken = retryRes.headers.get('vendure-auth-token');
		if (retryResponseToken) {
			cachedToken = retryResponseToken;
		}

		const retryJson = (await retryRes.json()) as {
			data?: T;
			errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
		};

		if (retryJson.errors?.length) {
			const message = retryJson.errors.map((e) => e.message).join(', ');
			throw new Error(`Admin API error: ${message}`);
		}

		if (!retryJson.data) {
			throw new Error('No data returned from Admin API');
		}

		return retryJson.data;
	}

	if (json.errors?.length) {
		const message = json.errors.map((e) => e.message).join(', ');
		throw new Error(`Admin API error: ${message}`);
	}

	if (!json.data) {
		throw new Error('No data returned from Admin API');
	}

	return json.data;
}

/**
 * Execute a read query against the Admin API.
 * Scoped to a seller's channel when channelToken is provided.
 */
export async function adminQuery<T = Record<string, unknown>>(
	query: string,
	variables?: Record<string, unknown>,
	channelToken?: string
): Promise<T> {
	return adminRequest<T>(query, variables, channelToken);
}

/**
 * Execute a mutation against the Admin API.
 * Scoped to a seller's channel when channelToken is provided.
 */
export async function adminMutate<T = Record<string, unknown>>(
	query: string,
	variables?: Record<string, unknown>,
	channelToken?: string
): Promise<T> {
	return adminRequest<T>(query, variables, channelToken);
}
