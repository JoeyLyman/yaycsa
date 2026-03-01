<script lang="ts">
	import { activeOffers } from '$lib/api/shop/offers.remote';
	import { formatMoney } from '$lib/utils/money';

	let { data } = $props();

	const seller = $derived(data.customer.customFields?.seller);
</script>

{#if seller}
	<h1 class="text-2xl font-bold">{seller.name}</h1>
	<p class="text-muted-foreground mt-2">This is how buyers see your farm.</p>

	<svelte:boundary>
		{#await activeOffers({ sellerId: seller.id })}
			<div class="text-muted-foreground mt-6 py-12 text-center">Loading offers...</div>
		{:then offers}
			{#if offers.length === 0}
				<p class="text-muted-foreground mt-4">No active offers yet.</p>
			{:else}
				{#each offers as offer (offer.id)}
					<div class="mt-6 rounded-md border p-4">
						{#if offer.notes}<p class="text-sm mt-1">{offer.notes}</p>{/if}

						{#if offer.fulfillmentOptions.length > 0}
							<div class="mt-2 flex flex-wrap gap-2">
								{#each offer.fulfillmentOptions as opt (opt.id)}
									<span class="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
										{opt.name} ({opt.type})
									</span>
								{/each}
							</div>
						{/if}

						<div class="mt-3 overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b text-left">
										<th class="py-1 pr-4">Product</th>
										<th class="py-1 pr-4">Unit</th>
										<th class="py-1 pr-4 text-right">Price</th>
										<th class="py-1 pr-4">Mode</th>
										<th class="py-1 text-right">Available</th>
									</tr>
								</thead>
								<tbody>
									{#each offer.lineItems as item (item.id)}
										<tr class="border-b">
											<td class="py-1 pr-4">{item.productVariant.name}</td>
											<td class="py-1 pr-4">{item.productVariant.customFields?.unitType ?? '—'}</td>
											<td class="py-1 pr-4 text-right">{formatMoney(item.price)}</td>
											<td class="py-1 pr-4">{item.pricingMode}</td>
											<td class="py-1 text-right">
												{#if item.quantityRemaining != null}
													{item.quantityRemaining}
												{:else}
													—
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/each}
			{/if}
		{/await}
		{#snippet failed(error)}
			<p class="text-destructive mt-4">Error loading offers.</p>
		{/snippet}
	</svelte:boundary>
{:else}
	<h1 class="text-2xl font-bold">My Sales Page</h1>
	<p class="text-muted-foreground mt-4">Nothing for sale yet.</p>
	<p class="text-muted-foreground mt-2 text-sm">
		Want to start selling? Contact us to get set up as a seller.
	</p>
{/if}
