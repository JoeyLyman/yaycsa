import { test as teardown } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getAdminToken } from './seller-helpers';

const ADMIN_API = 'http://localhost:3000/admin-api';
const testUserFile = resolve(import.meta.dirname, '../../.playwright/test-user.json');

teardown('delete test user', async () => {
	if (!existsSync(testUserFile)) {
		console.warn('No test user file found — skipping teardown');
		return;
	}

	const { id, sellerId } = JSON.parse(readFileSync(testUserFile, 'utf-8'));
	const adminToken = await getAdminToken();

	// If a test promoted this account to a seller, tear the seller down FIRST —
	// in FK-safe order — while the customer is still live. See teardownSeller for
	// why deleting the customer first would strand the seller. Current specs don't
	// create sellers, so `sellerId` is usually absent and this is skipped.
	if (sellerId) {
		const { teardownSeller } = await import('./seller-helpers');
		await teardownSeller(adminToken, { sellerId, customerId: id });
		return;
	}

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
