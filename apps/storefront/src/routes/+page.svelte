<script lang="ts">
	import { activeOffers } from '$lib/api/shop/offers.remote';
	import { activeCustomer } from '$lib/api/shop/auth.remote';
	import { formatMoney } from '$lib/utils/money';
</script>

<h1>YAY CSA — Smoke Test</h1>

<section>
	<h2>Active Customer</h2>
	<svelte:boundary>
		{#await activeCustomer() then customer}
			{#if customer}
				<p>Logged in as: {customer.firstName} {customer.lastName} ({customer.emailAddress})</p>
			{:else}
				<p>Not logged in (anonymous session)</p>
			{/if}
		{/await}
		{#snippet pending()}<p>Loading customer...</p>{/snippet}
		{#snippet failed(e)}<p>Error loading customer: {e instanceof Error ? e.message : 'Unknown error'}</p>{/snippet}
	</svelte:boundary>
</section>

<section>
	<h2>Active Offers</h2>
	<svelte:boundary>
		{#await activeOffers({}) then offers}
			{#if offers.length === 0}
				<p>No active offers found.</p>
			{:else}
				{#each offers as offer (offer.id)}
					<div style="border: 1px solid #ccc; padding: 1rem; margin-bottom: 1rem;">
						<h3>{offer.seller.name}</h3>
						<p>Status: {offer.status} | Valid from: {offer.validFrom}</p>
						{#if offer.notes}<p>{offer.notes}</p>{/if}

						<h4>Fulfillment Options</h4>
						<ul>
							{#each offer.fulfillmentOptions as opt (opt.id)}
								<li>{opt.name} ({opt.type})</li>
							{/each}
						</ul>

						<h4>Line Items</h4>
						<table style="width: 100%; border-collapse: collapse;">
							<thead>
								<tr>
									<th style="text-align: left;">Product</th>
									<th>Unit</th>
									<th>Price</th>
									<th>Mode</th>
									<th>Available</th>
								</tr>
							</thead>
							<tbody>
								{#each offer.lineItems as item (item.id)}
									<tr>
										<td>{item.productVariant.name}</td>
										<td>{item.productVariant.customFields?.unitType ?? '—'}</td>
										<td>{formatMoney(item.price)}</td>
										<td>{item.pricingMode}</td>
										<td>
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
				{/each}
			{/if}
		{/await}
		{#snippet pending()}<p>Loading offers...</p>{/snippet}
		{#snippet failed(e)}<p>Error loading offers: {e instanceof Error ? e.message : 'Unknown error'}</p>{/snippet}
	</svelte:boundary>
</section>
