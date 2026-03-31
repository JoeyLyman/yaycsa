import { test, expect } from '@playwright/test';

// All tests in this file run with the authenticated storageState
// (set up by tests/setup/auth.setup.ts, loaded via playwright.config.ts)
//
// The test user is a plain customer (not a seller). Seller-only pages
// like /me/products redirect non-sellers to /me via requireSellerContext().

test.describe('non-seller authenticated user', () => {
	test('/me/products redirects non-seller to /me', async ({ page }) => {
		await page.goto('/me/products');
		await expect(page).toHaveURL(/\/me$/, { timeout: 8000 });
	});
});

test.describe('seller account page (/me/account)', () => {
	test('loads and shows profile section', async ({ page }) => {
		await page.goto('/me/account');
		await expect(page).toHaveURL(/\/me\/account/);
		await expect(page.locator('text=Profile')).toBeVisible({ timeout: 8000 });
	});

	test('logout button is present', async ({ page }) => {
		await page.goto('/me/account');
		await expect(page.locator('[data-testid="logout-btn"]')).toBeVisible({ timeout: 8000 });
	});
});
