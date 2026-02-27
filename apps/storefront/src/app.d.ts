// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { VendureClient } from '$lib/api/vendure';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			vendure: VendureClient;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
