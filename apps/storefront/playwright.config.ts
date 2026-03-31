import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.test if present (TEST_SELLER_SLUG override; no credentials needed)
dotenv.config({ path: resolve(import.meta.dirname, '.env.test') });

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:5180',
		trace: 'on-first-retry',
	},
	projects: [
		// 1. Create test user via Admin API + log in via browser → saves storageState
		{
			name: 'setup',
			testMatch: '**/setup/auth.setup.ts',
		},
		// 2. Tests that don't require auth (login form, public pages, redirects)
		{
			name: 'public',
			testMatch: ['**/auth.spec.ts', '**/seller-page.spec.ts'],
		},
		// 3. Tests that require a logged-in user — wait for setup to finish first
		{
			name: 'authenticated',
			dependencies: ['setup'],
			use: { storageState: '.playwright/user.json' },
			testMatch: ['**/products.spec.ts'],
		},
		// 4. Delete the test user after all authenticated tests finish
		{
			name: 'teardown',
			dependencies: ['authenticated'],
			testMatch: '**/setup/auth.teardown.ts',
		},
	],
});
