<script lang="ts">
	import { formatMoney } from '$lib/utils/money';
	import { pricingModeLabel } from './offer-list-helpers';
	import type { OfferLineItemView } from './offer-list-types';
	import type { TableAudience } from '$lib/components/blocks/table-view-toggle';

	let {
		/** The offer's line items, already ordered by the normalizer. */
		lineItems,
		/** Which lens to render — `admin` reveals seller-only columns. */
		audience
	}: {
		lineItems: OfferLineItemView[];
		audience: TableAudience;
	} = $props();

	/** Whether seller-only columns (ordered, limit) should be shown. */
	let showingAdminColumns = $derived(audience === 'admin');
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b text-left">
				<th class="py-1 pr-4">Product</th>
				<th class="py-1 pr-4">Unit</th>
				<th class="py-1 pr-4 text-right">Price</th>
				<th class="py-1 pr-4">Mode</th>
				<th class="py-1 text-right">Available</th>
				{#if showingAdminColumns}
					<th class="py-1 pr-4 text-right">Ordered</th>
					<th class="py-1 text-right">Limit</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each lineItems as lineItem (lineItem.id)}
				<tr class="border-b last:border-b-0">
					<td class="py-1 pr-4">{lineItem.productVariantName}</td>
					<td class="py-1 pr-4">{lineItem.unitType ?? '—'}</td>
					<td class="py-1 pr-4 text-right">{formatMoney(lineItem.price)}</td>
					<td class="py-1 pr-4">{pricingModeLabel(lineItem.pricingMode)}</td>
					<td class="py-1 text-right">
						{lineItem.quantityRemaining ?? '—'}
					</td>
					{#if showingAdminColumns}
						<td class="py-1 pr-4 text-right">{lineItem.quantityOrdered ?? '—'}</td>
						<td class="py-1 text-right">
							{lineItem.quantityLimitMode === 'unlimited' || lineItem.quantityLimit == null
								? '—'
								: lineItem.quantityLimit}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
