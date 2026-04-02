import type { Cookies } from '@sveltejs/kit';
import type { TadaDocumentNode } from 'gql.tada';
import { print } from 'graphql';
import { getAuthToken, setAuthToken } from './auth.js';

const VENDURE_API_URL = 'http://localhost:3000/shop-api';

/**
 * Error raised when the storefront cannot reach the Vendure Shop API at all.
 * This is a network / service-availability problem, not a GraphQL validation error.
 */
export class VendureConnectionError extends Error {
	readonly url: string;

	constructor(url: string, cause?: unknown) {
		super(
			`Vendure server unavailable at ${url}. Make sure the server is running on localhost:3000, then refresh.`
		);
		this.name = 'VendureConnectionError';
		this.url = url;
		this.cause = cause;
	}
}

export type VendureClient = ReturnType<typeof createVendureClient>;

export function createVendureClient(cookies: Cookies) {
	async function request<TData, TVars>(
		document: TadaDocumentNode<TData, TVars>,
		variables?: TVars,
		options?: { channelToken?: string }
	): Promise<TData> {
		const token = getAuthToken(cookies);

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		if (options?.channelToken) {
			headers['vendure-token'] = options.channelToken;
		}

		const body = JSON.stringify({
			query: print(document),
			variables: variables ?? undefined
		});

		let res: Response;
		try {
			res = await fetch(VENDURE_API_URL, {
				method: 'POST',
				headers,
				body
			});
		} catch (err) {
			throw new VendureConnectionError(VENDURE_API_URL, err);
		}

		// Capture auth token from response
		const responseToken = res.headers.get('vendure-auth-token');
		if (responseToken) {
			setAuthToken(cookies, responseToken);
		}

		const json = (await res.json()) as {
			data?: TData;
			errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
		};

		// Handle GraphQL errors
		if (json.errors?.length) {
			const message = json.errors.map((e) => e.message).join(', ');
			throw new Error(`GraphQL error: ${message}`);
		}

		if (!json.data) {
			throw new Error('No data returned from Vendure API');
		}

		return json.data;
	}

	return {
		query: request,
		mutate: request
	};
}
