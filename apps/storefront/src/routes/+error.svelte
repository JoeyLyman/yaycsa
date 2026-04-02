<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/bits/button';

	/** Whether the current route error is a storefront-to-Vendure connectivity problem. */
	let isVendureUnavailable = $derived(
		(page.error?.message ?? '').toLowerCase().includes('vendure server unavailable')
	);
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-sm text-center">
		<h1 class="text-2xl font-bold">
			{isVendureUnavailable ? 'Vendure server unavailable' : 'Something went wrong'}
		</h1>
		<p class="text-muted-foreground mt-2">{page.error?.message ?? 'An unexpected error occurred'}</p>
		{#if isVendureUnavailable}
			<p class="text-muted-foreground mt-2 text-sm">Expected backend: <code>http://localhost:3000</code></p>
		{/if}
		<Button class="mt-4" onclick={() => invalidateAll()}>Try again</Button>
	</div>
</div>
