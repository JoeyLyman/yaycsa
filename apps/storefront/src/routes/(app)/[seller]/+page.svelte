<script lang="ts">
	import { onMount } from 'svelte';
	import { activeOffers } from '$lib/api/shop/offers.remote';
	import {
		OfferList,
		normalizeShopOffer,
		type OfferListItem,
		type RawOffer
	} from '$lib/components/bundles/offer-list';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';

	let { data } = $props();

	/** This seller's active offers, normalized for the shared offer-list table. */
	let offers = $state<OfferListItem[]>([]);

	/** Whether the initial offers load is still running. */
	let loading = $state(true);

	/** Error message from the offers load, if it failed. */
	let loadError = $state<string | null>(null);

	/**
	 * Load active offers client-side and normalize them into the shared view-model.
	 * Uses the same onMount-into-`$state` pattern as the other data pages (rather
	 * than `{#await}` in the template) — the remote query is client-only here, so
	 * there is no SSR hydratable to mismatch on hydration.
	 */
	async function loadOffers() {
		loading = true;
		loadError = null;
		try {
			const rawOffers = await activeOffers({ sellerId: data.seller.id });
			offers = (rawOffers as unknown as RawOffer[]).map(normalizeShopOffer);
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Failed to load offers';
			console.error('Failed to load seller offers:', error);
		} finally {
			loading = false;
		}
	}

	onMount(loadOffers);
</script>

<h1 class="text-2xl font-bold">{data.seller.name}</h1>

{#if loading}
	<div class="mt-6 flex justify-center py-12">
		<SpinnerSun class="size-8 text-muted-foreground" />
	</div>
{:else if loadError}
	<p class="mt-4 text-destructive">Error loading offers.</p>
{:else}
	<div class="mt-6">
		<OfferList {offers} emptyMessage="No active offers right now." />
	</div>
{/if}
