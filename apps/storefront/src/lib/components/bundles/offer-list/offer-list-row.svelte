<script lang="ts">
	import { getTableViewContext } from '$lib/components/blocks/table-view-toggle';
	import OfferListRowLineItems from './offer-list-row-line-items.svelte';
	import {
		fulfillmentOptionTypeLabel,
		offerStatusClasses,
		offerStatusLabel
	} from './offer-list-helpers';
	import type { OfferListItem } from './offer-list-types';

	let {
		/** The offer to render. */
		offer
	}: {
		offer: OfferListItem;
	} = $props();

	/**
	 * Shared audience context. Absent on the public seller page (which is always
	 * the customer lens), so it defaults to `customer` when no provider is mounted.
	 */
	const tableViewContext = getTableViewContext();

	/** Current audience lens for this row. */
	let audience = $derived(tableViewContext ? tableViewContext.audience() : 'customer');

	/** Whether seller-only affordances (status chip, admin columns) are shown. */
	let showingAdminView = $derived(audience === 'admin');

	/** Short, locale-aware date+time for the validity window. */
	function formatDateTime(isoValue: string | null): string {
		if (!isoValue) return '—';
		const parsedDate = new Date(isoValue);
		if (Number.isNaN(parsedDate.getTime())) return '—';
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(parsedDate);
	}
</script>

<div class="border-b px-3 py-3 last:border-b-0">
	<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
		{#if showingAdminView && offer.status}
			<span class="text-sm font-medium {offerStatusClasses(offer.status)}">
				{offerStatusLabel(offer.status)}
			</span>
		{/if}
		<span class="text-xs text-muted-foreground">
			{formatDateTime(offer.validFrom)}
			{#if offer.validUntil}
				→ {formatDateTime(offer.validUntil)}
			{:else}
				· no end date
			{/if}
		</span>
	</div>

	{#if offer.notes}
		<p class="mb-2 text-sm">{offer.notes}</p>
	{/if}

	{#if offer.fulfillmentOptions.length > 0}
		<div class="mb-3 flex flex-wrap gap-2">
			{#each offer.fulfillmentOptions as fulfillmentOption (fulfillmentOption.id)}
				<span class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{fulfillmentOption.name} ({fulfillmentOptionTypeLabel(fulfillmentOption.type)})
				</span>
			{/each}
		</div>
	{/if}

	{#if offer.lineItems.length > 0}
		<OfferListRowLineItems lineItems={offer.lineItems} {audience} />
	{:else}
		<p class="text-sm text-muted-foreground">No items on this offer.</p>
	{/if}
</div>
