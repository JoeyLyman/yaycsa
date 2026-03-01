<script lang="ts">
	import { sellers } from '$lib/api/shop/sellers.remote';

	let { data } = $props();
</script>

{#if data.customer}
	<h1 class="text-2xl font-bold">Welcome, {data.customer.firstName}</h1>
{:else}
	<h1 class="text-2xl font-bold">Local farms &amp; producers</h1>
{/if}
<p class="text-muted-foreground mt-2">Browse offers from local farms and producers.</p>

<svelte:boundary>
	{#await sellers()}
		<div class="text-muted-foreground mt-6 py-12 text-center">Loading sellers...</div>
	{:then sellerList}
		{#if sellerList.length === 0}
			<p class="text-muted-foreground mt-6">No sellers with active offers right now.</p>
		{:else}
			<div class="mt-6 space-y-2">
				{#each sellerList as seller (seller.id)}
					{#if seller.slug}
						<a
							href="/{seller.slug}"
							class="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent"
						>
							<span class="font-medium">{seller.name}</span>
						</a>
					{/if}
				{/each}
			</div>
		{/if}
	{/await}
	{#snippet failed(error)}
		<p class="text-destructive mt-4">Error loading sellers.</p>
	{/snippet}
</svelte:boundary>
