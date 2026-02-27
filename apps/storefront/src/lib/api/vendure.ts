import type { Cookies } from '@sveltejs/kit';
import type { TadaDocumentNode } from 'gql.tada';
import { print } from 'graphql';
import { getAuthToken, setAuthToken } from './auth.js';

const VENDURE_API_URL = 'http://localhost:3000/shop-api';

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

		const res = await fetch(VENDURE_API_URL, {
			method: 'POST',
			headers,
			body
		});

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
