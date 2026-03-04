<script lang="ts">
	import { sellers } from '$lib/api/shop/sellers.remote';

	let { data } = $props();

	/** Whether to show all sellers, including those without active offers. */
	let showAll = $state(false);
</script>

{#if data.customer}
	<h1 class="text-2xl font-bold">Welcome, {data.customer.firstName}</h1>
{:else}
	<h1 class="text-2xl font-bold">Local farms &amp; producers</h1>
{/if}
<p class="text-muted-foreground mt-2">Browse offers from local farms and producers.</p>

<div class="mt-4 flex gap-1 text-sm">
	<button
		class="rounded-md px-3 py-1.5 font-medium transition-colors {!showAll
			? 'bg-accent text-accent-foreground'
			: 'text-muted-foreground hover:text-foreground'}"
		onclick={() => (showAll = false)}
	>
		Active offers
	</button>
	<button
		class="rounded-md px-3 py-1.5 font-medium transition-colors {showAll
			? 'bg-accent text-accent-foreground'
			: 'text-muted-foreground hover:text-foreground'}"
		onclick={() => (showAll = true)}
	>
		All sellers
	</button>
</div>

<svelte:boundary>
	{#await sellers({ activeOffersOnly: !showAll })}
		<div class="text-muted-foreground mt-6 py-12 text-center">Loading sellers...</div>
	{:then sellerList}
		{#if sellerList.length === 0}
			<p class="text-muted-foreground mt-6">
				{showAll ? 'No sellers found.' : 'No sellers with active offers right now.'}
			</p>
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
