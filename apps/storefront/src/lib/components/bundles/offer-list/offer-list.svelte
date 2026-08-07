<script lang="ts">
	import OfferListRow from './offer-list-row.svelte';
	import type { OfferListItem } from './offer-list-types';

	let {
		/** Offers to render, already filtered/sorted by the parent page. */
		offers,
		/** Message shown when there are no offers to display. */
		emptyMessage = 'No offers to show.'
	}: {
		offers: OfferListItem[];
		emptyMessage?: string;
	} = $props();
</script>

<div class="rounded-md border">
	{#if offers.length === 0}
		<div class="px-3 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
	{:else}
		{#each offers as offer (offer.id)}
			<OfferListRow {offer} />
		{/each}
	{/if}
</div>
