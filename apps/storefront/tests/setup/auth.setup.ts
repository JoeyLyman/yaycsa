import { test as setup, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ADMIN_API = 'http://localhost:3000/admin-api';
const playwrightDir = resolve(import.meta.dirname, '../../.playwright');
const authFile = resolve(playwrightDir, 'user.json');
const testUserFile = resolve(playwrightDir, 'test-user.json');

/** Authenticate with the Vendure Admin API and return a bearer token. */
async function getAdminToken(): Promise<string> {
	const res = await fetch(ADMIN_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			query: `mutation {
				login(username: "superadmin", password: "superadmin", rememberMe: false) {
					... on CurrentUser { id }
					... on InvalidCredentialsError { message }
				}
			}`,
		}),
	});
	const token = res.headers.get('vendure-auth-token');
	if (!token) throw new Error('Failed to get admin token — is the Vendure server running?');
	return token;
}

setup('create test user and authenticate', async ({ page }) => {
	mkdirSync(playwrightDir, { recursive: true });

	const adminToken = await getAdminToken();

	// Use a timestamp-based email so parallel runs don't collide
	const testEmail = `playwright-${Date.now()}@test.local`;
	const testPassword = 'PlaywrightTest123!';

	// Create a verified customer via Admin API (admin-created accounts skip email verification)
	const createRes = await fetch(ADMIN_API, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${adminToken}`,
		},
		body: JSON.stringify({
			query: `mutation CreateCustomer($input: CreateCustomerInput!, $password: String) {
				createCustomer(input: $input, password: $password) {
					... on Customer { id emailAddress }
					... on EmailAddressConflictError { message }
				}
			}`,
			variables: {
				input: {
					firstName: 'Playwright',
					lastName: 'Test',
					emailAddress: testEmail,
				},
				password: testPassword,
			},
		}),
	});

	const createData = await createRes.json();
	const customer = createData.data?.createCustomer;
	if (!customer?.id) {
		throw new Error(`Failed to create test customer: ${JSON.stringify(createData)}`);
	}

	// Persist test user info for teardown to delete them
	writeFileSync(testUserFile, JSON.stringify({ id: customer.id, email: testEmail }));

	// Log in via the browser to capture storageState (cookies)
	await page.goto('/login');
	await expect(page.locator('#email')).toBeVisible();

	await page.fill('#email', testEmail);
	await page.fill('#password', testPassword);
	await page.click('button[type="submit"]');

	// Wait for redirect away from /login — confirms auth succeeded
	await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 });

	await page.context().storageState({ path: authFile });
});
