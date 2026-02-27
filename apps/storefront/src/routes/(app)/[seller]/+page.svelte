<script lang="ts">
	import { page } from '$app/state';

	const sellerName = $derived(
		page.params.seller
			.split('-')
			.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	);
</script>

<h1 class="text-2xl font-bold">{sellerName}</h1>
<p class="text-muted-foreground mt-2">Seller page coming soon.</p>
