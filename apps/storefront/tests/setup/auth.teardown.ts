import { test as teardown } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ADMIN_API = 'http://localhost:3000/admin-api';
const testUserFile = resolve(import.meta.dirname, '../../.playwright/test-user.json');

/** Authenticate with the Vendure Admin API and return a bearer token. */
async function getAdminToken(): Promise<string> {
	const res = await fetch(ADMIN_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			query: `mutation {
				login(username: "superadmin", password: "superadmin", rememberMe: false) {
					... on CurrentUser { id }
				}
			}`,
		}),
	});
	const token = res.headers.get('vendure-auth-token');
	if (!token) throw new Error('Failed to get admin token during teardown');
	return token;
}

teardown('delete test user', async () => {
	if (!existsSync(testUserFile)) {
		console.warn('No test user file found — skipping teardown');
		return;
	}

	const { id } = JSON.parse(readFileSync(testUserFile, 'utf-8'));
	const adminToken = await getAdminToken();

	const res = await fetch(ADMIN_API, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${adminToken}`,
		},
		body: JSON.stringify({
			query: `mutation DeleteCustomer($id: ID!) {
				deleteCustomer(id: $id) { result message }
			}`,
			variables: { id },
		}),
	});

	const data = await res.json();
	const result = data.data?.deleteCustomer?.result;
	if (result !== 'DELETED') {
		console.warn(`Teardown: unexpected deleteCustomer result: ${JSON.stringify(data)}`);
	}
});
