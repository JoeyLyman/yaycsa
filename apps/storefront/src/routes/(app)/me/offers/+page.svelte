<script lang="ts">
	import { activeOffers } from '$lib/api/shop/offers.remote';
	import { formatMoney } from '$lib/utils/money';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
</script>

{#await activeOffers({})}
	<div class="flex items-center justify-center py-32">
		<SpinnerSun class="text-muted-foreground size-8" />
	</div>
{:then offers}
	<h1 class="text-2xl font-bold">Offers</h1>

	{#if offers.length === 0}
		<p class="text-muted-foreground mt-4">No active offers found.</p>
	{:else}
		{#each offers as offer (offer.id)}
			<div class="mt-6 rounded-md border p-4">
				<h2 class="text-lg font-semibold">{offer.seller.name}</h2>
				<p class="text-muted-foreground text-sm">Status: {offer.status} | Valid from: {offer.validFrom}</p>
				{#if offer.notes}<p class="text-sm mt-1">{offer.notes}</p>{/if}

				<h3 class="mt-3 text-sm font-medium">Fulfillment Options</h3>
				<ul class="text-sm list-disc pl-5">
					{#each offer.fulfillmentOptions as opt (opt.id)}
						<li>{opt.name} ({opt.type})</li>
					{/each}
				</ul>

				<h3 class="mt-3 text-sm font-medium">Line Items</h3>
				<div class="mt-1 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b text-left">
								<th class="py-1 pr-4">Product</th>
								<th class="py-1 pr-4">Unit</th>
								<th class="py-1 pr-4">Price</th>
								<th class="py-1 pr-4">Mode</th>
								<th class="py-1">Available</th>
							</tr>
						</thead>
						<tbody>
							{#each offer.lineItems as item (item.id)}
								<tr class="border-b">
									<td class="py-1 pr-4">{item.productVariant.name}</td>
									<td class="py-1 pr-4">{item.productVariant.customFields?.unitType ?? '—'}</td>
									<td class="py-1 pr-4">{formatMoney(item.price)}</td>
									<td class="py-1 pr-4">{item.pricingMode}</td>
									<td class="py-1">
										{#if item.quantityRemaining != null}
											{item.quantityRemaining} left
										{:else}
											unlimited
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
{:catch e}
	<p class="text-destructive mt-4">Error loading offers: {e instanceof Error ? e.message : 'Unknown error'}</p>
{/await}
