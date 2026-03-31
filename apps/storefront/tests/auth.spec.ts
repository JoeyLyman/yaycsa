import { test, expect } from '@playwright/test';

test.describe('login page', () => {
	test('renders login form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.locator('#email')).toBeVisible();
		await expect(page.locator('#password')).toBeVisible();
		await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
	});

	test('shows error on bad credentials', async ({ page }) => {
		await page.goto('/login');
		await page.fill('#email', 'nobody-xyz@example.com');
		await page.fill('#password', 'wrongpassword123');
		await page.click('[data-testid="login-submit"]');

		// Bad credentials return a field-level issue on the email field (via invalid()),
		// not the top-level errorMessage. Look for the inline validation text.
		await expect(page.locator('text=Invalid email or password')).toBeVisible({ timeout: 8000 });
		await expect(page).toHaveURL(/\/login/);
	});

	test('has link to register and forgot password', async ({ page }) => {
		await page.goto('/login');
		// Use the card footer links specifically — navbar also has a register link
		const footer = page.locator('[class*="card-footer"], footer').first();
		await expect(page.locator('a[href="/register"]').last()).toBeVisible();
		await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
	});
});

test.describe('register page', () => {
	test('renders registration form', async ({ page }) => {
		await page.goto('/register');
		await expect(page.locator('#firstName')).toBeVisible();
		await expect(page.locator('#lastName')).toBeVisible();
		await expect(page.locator('#email')).toBeVisible();
		await expect(page.locator('#password')).toBeVisible();
		await expect(page.locator('[data-testid="register-submit"]')).toBeVisible();
	});

	test('submitting register form shows "check your email" confirmation', async ({ page }) => {
		const uniqueEmail = `playwright-reg-${Date.now()}@test.local`;

		await page.goto('/register');
		// Wait for full hydration so the form enhance() callback is attached
		await page.waitForLoadState('networkidle');

		await page.locator('#firstName').fill('Playwright');
		await page.locator('#lastName').fill('Regtest');
		await page.locator('#email').fill(uniqueEmail);
		await page.locator('#password').fill('PlaywrightTest123!');
		await page.click('[data-testid="register-submit"]');

		// Should swap to the "Check your email" confirmation card — not show an error.
		await expect(page.locator('[data-testid="register-success"]')).toBeVisible({ timeout: 15000 });
		await expect(page.locator('[data-testid="register-error"]')).not.toBeVisible();
	});
});

test.describe('auth guards', () => {
	test('redirects unauthenticated user from /me/products to /login', async ({ page }) => {
		await page.goto('/me/products');
		await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
	});

	test('redirects unauthenticated user from /me/account to /login', async ({ page }) => {
		await page.goto('/me/account');
		await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
	});

	test('redirects unauthenticated user from /me/offers to /login', async ({ page }) => {
		await page.goto('/me/offers');
		await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
	});
});
