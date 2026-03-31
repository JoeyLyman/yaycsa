import { test, expect } from '@playwright/test';

// Defaults to GTF — set TEST_SELLER_SLUG in .env.test to override
const SELLER_SLUG = process.env.TEST_SELLER_SLUG ?? 'gathering-together-farm';

test.describe('public seller page', () => {
	test('loads and shows seller name', async ({ page }) => {
		await page.goto(`/${SELLER_SLUG}`);

		// Seller name in h1
		const heading = page.locator('h1');
		await expect(heading).toBeVisible({ timeout: 8000 });
		await expect(heading).not.toBeEmpty();
	});

	test('shows offer table or empty state — not a crash', async ({ page }) => {
		await page.goto(`/${SELLER_SLUG}`);

		// Either the offer table or the "No active offers" message should appear
		const table = page.locator('table').first();
		const emptyState = page.locator('text=No active offers');

		await expect(table.or(emptyState)).toBeVisible({ timeout: 10000 });
	});

	test('no console errors on seller page', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await page.goto(`/${SELLER_SLUG}`);
		// Wait for async offer loading to settle
		await page.waitForLoadState('networkidle');

		expect(errors).toHaveLength(0);
	});

	test('unknown seller slug shows error page, not a blank screen', async ({ page }) => {
		await page.goto('/this-seller-does-not-exist-xyz-404');

		// Should render something (error boundary or error page), not be empty
		const body = page.locator('body');
		await expect(body).not.toBeEmpty();

		// Should NOT show the normal seller heading
		await expect(page.locator('h1')).not.toContainText('undefined');
	});
});
