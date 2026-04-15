<script lang="ts">
	import { afterNavigate, goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		myOffersWorkspace,
		type OfferStatus,
		type SellerFulfillmentOptionWorkspaceItem,
		type SellerOffersWorkspaceData
	} from '$lib/api/admin/offers.remote';
	import {
		createFulfillmentOption,
		deleteFulfillmentOption,
		restoreFulfillmentOption,
		updateFulfillmentOption,
		type FulfillmentOptionType
	} from '$lib/api/admin/fulfillment-options.remote';
	import { Button } from '$lib/components/bits/button';
	import { Checkbox } from '$lib/components/bits/checkbox';
	import { HeaderCountFilter } from '$lib/components/bits/header-count-filter';
	import { HeaderTabs } from '$lib/components/bits/header-tabs';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import {
		FulfillmentOptionList,
		deriveFulfillmentOptionUsage,
		getUsageForOption,
		sortFulfillmentOptionEditorRows,
		toEditorRow,
		type FulfillmentOptionEditorRow,
		type FulfillmentOptionMutationInput
	} from '$lib/components/bundles/fulfillment-option-list';
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	type OffersWorkspaceTab = 'offers' | 'fulfillment-options';
	type WorkspaceCountFilter = 'active' | 'total';

	/** Full workspace payload used for the summary strip and both tab views. */
	let workspaceData = $state<SellerOffersWorkspaceData | null>(null);

	/** Whether the initial workspace load or a later refresh is still running. */
	let loading = $state(true);

	/** Error message from the initial load or the most recent refresh attempt. */
	let loadError = $state<string | null>(null);

	/** Sorted saved fulfillment-option rows for the editor UI, rebuilt on every load. */
	let fulfillmentOptionRows = $state<FulfillmentOptionEditorRow[]>([]);

	/** Keys for currently-open draft slots. Each draft row holds its own local working state. */
	let fulfillmentOptionDraftKeys = $state<string[]>([]);

	/** Counter used to generate stable draft keys before persistence. */
	let fulfillmentOptionDraftIdCounter = $state(0);

	/** Row/draft IDs currently running a save, delete, or restore mutation. */
	let pendingRowIds = new SvelteSet<string>();

	/** Row-level validation or mutation errors keyed by row ID or draft key. */
	let rowErrors = new SvelteMap<string, string>();

	/** Saved-row IDs currently showing the inline delete confirmation state. */
	let confirmingDeleteRowIds = new SvelteSet<string>();

	/** Deleted-row IDs currently showing the inline permanent-delete confirmation state. */
	let confirmingDeletedPermanentRowIds = new SvelteSet<string>();

	/** URL-synced selected workspace tab so refresh/back/deep-linking preserve context. */
	let selectedWorkspaceTab = $state<OffersWorkspaceTab>('offers');

	/** The offers-table count filter. Defaults to total so sellers see the full list first. */
	let selectedOffersCountFilter = $state<WorkspaceCountFilter>('total');

	/** The fulfillment-options count filter. Defaults to total so sellers see the full list first. */
	let selectedFulfillmentCountFilter = $state<WorkspaceCountFilter>('total');

	/** Whether scheduled pickup options are currently included in the fulfillment table filters. */
	let showingScheduledPickupOptions = $state(true);

	/** Whether scheduled delivery options are currently included in the fulfillment table filters. */
	let showingScheduledDeliveryOptions = $state(true);

	/** Whether shipping options are currently included in the fulfillment table filters. */
	let showingShippingOptions = $state(true);

	/** Whether deleted fulfillment options should be included below the current rows. */
	let showingDeletedFulfillmentOptions = $state(false);

	/** Active-offer count shown in the compact offers-tab count filter. */
	let activeOfferCount = $derived(workspaceData?.activeOfferCount ?? 0);

	/** Total non-deleted offer count shown in the compact offers-tab count filter. */
	let offerCount = $derived(workspaceData?.offerCount ?? 0);

	/** Active current fulfillment-option count shown in the compact fulfillment count filter. */
	let activeFulfillmentOptionCount = $derived(workspaceData?.activeFulfillmentOptionCount ?? 0);

	/** Total current non-deleted fulfillment-option count shown in the compact fulfillment count filter. */
	let fulfillmentOptionCount = $derived(workspaceData?.fulfillmentOptionCount ?? 0);

	/** All seller offers, used for deriving fulfillment-option usage counts. */
	let loadedOffers = $derived(workspaceData?.offers ?? []);

	/** Deleted fulfillment options available when the seller turns on the show-deleted filter. */
	let deletedFulfillmentOptions = $derived(workspaceData?.deletedFulfillmentOptions ?? []);

	/** Per-option usage counts derived from the seller's loaded offers. */
	let fulfillmentOptionUsageMap = $derived(deriveFulfillmentOptionUsage(loadedOffers));

	/** The count filter currently visible in the header row, based on the selected workspace tab. */
	let selectedWorkspaceCountFilter = $derived(
		selectedWorkspaceTab === 'offers' ? selectedOffersCountFilter : selectedFulfillmentCountFilter
	);

	/** Offers visible in the offers table after applying the active/total count filter. */
	let filteredOffers = $derived.by(() => {
		const offers = loadedOffers;
		if (selectedOffersCountFilter === 'active') {
			return offers.filter((offer) => offer.status === 'active');
		}
		return offers;
	});

	/** Current saved fulfillment options visible after type and active/total filtering. */
	let filteredFulfillmentOptionRows = $derived.by(() =>
		fulfillmentOptionRows.filter((row) => {
			const usage = getUsageForOption(fulfillmentOptionUsageMap, row.id);
			return matchesFulfillmentOptionFilters(
				row.type,
				usage.activeOfferCount,
				selectedFulfillmentCountFilter
			);
		})
	);

	/** Deleted fulfillment options visible after type and active/total filtering when show deleted is on. */
	let filteredDeletedFulfillmentOptions = $derived.by(() =>
		deletedFulfillmentOptions.filter((row) =>
			matchesFulfillmentOptionFilters(row.type, row.activeOfferCount, selectedFulfillmentCountFilter)
		)
	);

	/** Header-level tab definitions rendered in the page title area. */
	let workspaceHeaderTabs = $derived.by(() => [
		{ value: 'offers', label: 'Offers', href: getWorkspaceTabHref('offers') },
		{
			value: 'fulfillment-options',
			label: 'Fulfillment Options',
			href: getWorkspaceTabHref('fulfillment-options')
		}
	]);

	function getWorkspaceTabFromUrl(url: URL): OffersWorkspaceTab {
		return url.searchParams.get('tab') === 'fulfillment-options' ? 'fulfillment-options' : 'offers';
	}

	onMount(() => {
		selectedWorkspaceTab = getWorkspaceTabFromUrl(page.url);
		void loadWorkspaceData();
	});

	afterNavigate(() => {
		selectedWorkspaceTab = getWorkspaceTabFromUrl(page.url);
	});

	function getErrorMessage(error: unknown, fallbackMessage: string): string {
		if (error instanceof Error && error.message) return error.message;
		if (typeof error === 'string' && error.length > 0) return error;
		return fallbackMessage;
	}

	function formatCompactDateTime(isoValue: string | null): string {
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

	function formatDeletedDate(isoValue: string | null): string {
		if (!isoValue) return '—';
		const parsedDate = new Date(isoValue);
		if (Number.isNaN(parsedDate.getTime())) return '—';
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(parsedDate);
	}

	async function loadWorkspaceData() {
		loading = true;
		loadError = null;
		try {
			workspaceData = await myOffersWorkspace();
			fulfillmentOptionRows = sortFulfillmentOptionEditorRows(
				(workspaceData?.currentFulfillmentOptions ?? []).map(toEditorRow)
			);
		} catch (error) {
			loadError = getErrorMessage(error, 'Failed to load offers workspace');
			console.error('Failed to load offers workspace:', error);
		} finally {
			loading = false;
		}
	}

	function buildSearchParamsHref(updates: Record<string, string | null>): string {
		const nextUrl = new URL(page.url);
		for (const [key, value] of Object.entries(updates)) {
			if (value == null) {
				nextUrl.searchParams.delete(key);
			} else {
				nextUrl.searchParams.set(key, value);
			}
		}
		return `${nextUrl.pathname}${nextUrl.search}`;
	}

	function updateSearchParams(updates: Record<string, string | null>) {
		goto(buildSearchParamsHref(updates), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function selectWorkspaceTab(tab: OffersWorkspaceTab) {
		selectedWorkspaceTab = tab;
		updateSearchParams({ tab: tab === 'offers' ? null : tab });
	}

	function getWorkspaceTabHref(tab: OffersWorkspaceTab): string {
		return buildSearchParamsHref({ tab: tab === 'offers' ? null : tab });
	}

	function handleWorkspaceHeaderTabSelect(value: string) {
		if (value !== 'offers' && value !== 'fulfillment-options') return;
		selectWorkspaceTab(value);
	}

	function handleWorkspaceCountFilterSelect(value: WorkspaceCountFilter) {
		if (selectedWorkspaceTab === 'offers') {
			selectedOffersCountFilter = value;
			return;
		}

		selectedFulfillmentCountFilter = value;
	}

	function matchesFulfillmentOptionFilters(
		type: FulfillmentOptionType,
		activeOfferCount: number,
		countFilter: WorkspaceCountFilter
	): boolean {
		const matchesType =
			(type === 'scheduled_pickup' && showingScheduledPickupOptions) ||
			(type === 'scheduled_delivery' && showingScheduledDeliveryOptions) ||
			(type === 'shipping' && showingShippingOptions);
		if (!matchesType) return false;

		if (countFilter === 'active') {
			return activeOfferCount > 0;
		}

		return true;
	}

	function addFulfillmentOptionDraftRow() {
		const draftKey = `__draft_${++fulfillmentOptionDraftIdCounter}`;
		fulfillmentOptionDraftKeys = [...fulfillmentOptionDraftKeys, draftKey];
		rowErrors.delete(draftKey);
	}

	function cancelFulfillmentOptionDraftRow(draftKey: string) {
		fulfillmentOptionDraftKeys = fulfillmentOptionDraftKeys.filter((key) => key !== draftKey);
		rowErrors.delete(draftKey);
	}

	async function saveExistingFulfillmentOptionRow(
		rowId: string,
		payload: FulfillmentOptionMutationInput
	) {
		pendingRowIds.add(rowId);
		rowErrors.delete(rowId);

		try {
			await updateFulfillmentOption({ id: rowId, ...payload });
			await invalidateAll();
			await loadWorkspaceData();
		} catch (error) {
			console.error('Failed to update fulfillment option:', error);
			rowErrors.set(rowId, getErrorMessage(error, 'Failed to update fulfillment option'));
		} finally {
			pendingRowIds.delete(rowId);
		}
	}

	async function createFulfillmentOptionFromDraft(
		draftKey: string,
		payload: FulfillmentOptionMutationInput
	) {
		pendingRowIds.add(draftKey);
		rowErrors.delete(draftKey);

		try {
			await createFulfillmentOption(payload);
			fulfillmentOptionDraftKeys = fulfillmentOptionDraftKeys.filter((key) => key !== draftKey);
			await invalidateAll();
			await loadWorkspaceData();
		} catch (error) {
			console.error('Failed to create fulfillment option:', error);
			rowErrors.set(draftKey, getErrorMessage(error, 'Failed to create fulfillment option'));
		} finally {
			pendingRowIds.delete(draftKey);
		}
	}

	function beginDeleteExistingFulfillmentOptionRow(rowId: string) {
		confirmingDeleteRowIds.add(rowId);
		rowErrors.delete(rowId);
	}

	function cancelDeleteExistingFulfillmentOptionRow(rowId: string) {
		confirmingDeleteRowIds.delete(rowId);
	}

	async function confirmDeleteExistingFulfillmentOptionRow(rowId: string) {
		const usage = getUsageForOption(fulfillmentOptionUsageMap, rowId);
		const canPermanentlyDelete = usage.offerCount === 0;

		pendingRowIds.add(rowId);
		rowErrors.delete(rowId);

		try {
			await deleteFulfillmentOption({ id: rowId, permanently: canPermanentlyDelete });
			await invalidateAll();
			await loadWorkspaceData();
			confirmingDeleteRowIds.delete(rowId);
		} catch (error) {
			console.error('Failed to delete fulfillment option:', error);
			rowErrors.set(rowId, getErrorMessage(error, 'Failed to delete fulfillment option'));
		} finally {
			pendingRowIds.delete(rowId);
		}
	}

	async function restoreDeletedFulfillmentOptionRow(rowId: string) {
		pendingRowIds.add(rowId);
		rowErrors.delete(rowId);

		try {
			await restoreFulfillmentOption(rowId);
			await invalidateAll();
			await loadWorkspaceData();
		} catch (error) {
			console.error('Failed to restore fulfillment option:', error);
			rowErrors.set(rowId, getErrorMessage(error, 'Failed to restore fulfillment option'));
		} finally {
			pendingRowIds.delete(rowId);
		}
	}

	function beginPermanentDeleteDeletedRow(rowId: string) {
		confirmingDeletedPermanentRowIds.add(rowId);
	}

	function cancelPermanentDeleteDeletedRow(rowId: string) {
		confirmingDeletedPermanentRowIds.delete(rowId);
	}

	async function permanentlyDeleteDeletedFulfillmentOptionRow(
		row: SellerFulfillmentOptionWorkspaceItem
	) {
		pendingRowIds.add(row.id);
		rowErrors.delete(row.id);

		try {
			await deleteFulfillmentOption({ id: row.id, permanently: true });
			await invalidateAll();
			await loadWorkspaceData();
			confirmingDeletedPermanentRowIds.delete(row.id);
		} catch (error) {
			console.error('Failed to permanently delete fulfillment option:', error);
			rowErrors.set(
				row.id,
				getErrorMessage(error, 'Failed to permanently delete fulfillment option')
			);
		} finally {
			pendingRowIds.delete(row.id);
		}
	}

	function getOfferStatusLabel(status: OfferStatus): string {
		if (status === 'active') return 'Active';
		if (status === 'draft') return 'Draft';
		if (status === 'paused') return 'Paused';
		return 'Expired';
	}

	function getOfferStatusClasses(status: OfferStatus): string {
		if (status === 'active') return 'text-emerald-700';
		if (status === 'draft') return 'text-amber-700';
		if (status === 'paused') return 'text-slate-600';
		return 'text-muted-foreground';
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-32">
		<SpinnerSun class="size-8 text-muted-foreground" />
	</div>
{:else if loadError}
	<div class="space-y-4">
		<h1 class="text-2xl font-bold">Offers</h1>
		<p class="text-destructive">Error loading offers workspace: {loadError}</p>
		<Button variant="outline" onclick={loadWorkspaceData}>Try again</Button>
	</div>
{:else}
	<div class="space-y-4 pb-10">
		<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
			<HeaderTabs
				items={workspaceHeaderTabs}
				selectedValue={selectedWorkspaceTab}
				onselect={handleWorkspaceHeaderTabSelect}
				ariaLabel="Offers workspace sections"
				size="xl"
			/>
			<HeaderCountFilter
				activeCount={selectedWorkspaceTab === 'offers' ? activeOfferCount : activeFulfillmentOptionCount}
				totalCount={selectedWorkspaceTab === 'offers' ? offerCount : fulfillmentOptionCount}
				selectedValue={selectedWorkspaceCountFilter}
				onselect={handleWorkspaceCountFilterSelect}
				ariaLabel={selectedWorkspaceTab === 'offers'
					? 'Offers count filters'
					: 'Fulfillment option count filters'}
				class="shrink-0 md:justify-end"
			/>
		</div>

		{#if selectedWorkspaceTab === 'offers'}
			<div class="space-y-3">
				<div class="rounded-md border">
					{#if filteredOffers.length === 0}
						<div class="px-3 py-8 text-center text-sm text-muted-foreground">
							{#if loadedOffers.length === 0}
								No offers yet. The full seller offers table and editor are the next step.
							{:else}
								No offers match the current filter.
							{/if}
						</div>
					{:else}
						<div>
							{#each filteredOffers as offer (offer.id)}
								<div class="border-b px-3 py-3 last:border-b-0">
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0 space-y-1">
											<p class="text-sm font-medium {getOfferStatusClasses(offer.status)}">
												{getOfferStatusLabel(offer.status)}
											</p>
											<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
												<span>
													{formatCompactDateTime(offer.validFrom)}
													{#if offer.validUntil}
														→ {formatCompactDateTime(offer.validUntil)}
													{:else}
														· no end date
													{/if}
												</span>
												<span>{offer.lineItemCount} items</span>
												{#if offer.fulfillmentOptionNames.length > 0}
													<span>{offer.fulfillmentOptionNames.join(', ')}</span>
												{:else}
													<span>No fulfillment options</span>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<Button variant="outline" class="w-full" disabled>+ Add Offer (coming next)</Button>
			</div>
		{:else}
			<div class="space-y-3" data-testid="fulfillment-options-table">
				<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="scheduled-pickup-filter" bind:checked={showingScheduledPickupOptions} />
						<label for="scheduled-pickup-filter">Scheduled Pickup</label>
					</div>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="scheduled-delivery-filter" bind:checked={showingScheduledDeliveryOptions} />
						<label for="scheduled-delivery-filter">Scheduled Delivery</label>
					</div>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="shipping-filter" bind:checked={showingShippingOptions} />
						<label for="shipping-filter">Ship</label>
					</div>
					<span aria-hidden="true" class="text-border">|</span>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="show-deleted-filter" bind:checked={showingDeletedFulfillmentOptions} />
						<label for="show-deleted-filter">Show deleted</label>
					</div>
				</div>

				<FulfillmentOptionList
					rows={filteredFulfillmentOptionRows}
					draftKeys={fulfillmentOptionDraftKeys}
					deletedRows={filteredDeletedFulfillmentOptions}
					showDeleted={showingDeletedFulfillmentOptions}
					offers={loadedOffers}
					{pendingRowIds}
					{rowErrors}
					confirmingDeleteIds={confirmingDeleteRowIds}
					confirmingPermanentDeleteIds={confirmingDeletedPermanentRowIds}
					onsaveRow={saveExistingFulfillmentOptionRow}
					onbegindelete={beginDeleteExistingFulfillmentOptionRow}
					oncanceldelete={cancelDeleteExistingFulfillmentOptionRow}
					onconfirmdelete={confirmDeleteExistingFulfillmentOptionRow}
					oncreateDraft={createFulfillmentOptionFromDraft}
					oncancelDraft={cancelFulfillmentOptionDraftRow}
					onadddraft={addFulfillmentOptionDraftRow}
					onrestoreDeleted={restoreDeletedFulfillmentOptionRow}
					onbeginpermanentdelete={beginPermanentDeleteDeletedRow}
					oncancelpermanentdelete={cancelPermanentDeleteDeletedRow}
					onconfirmpermanentdelete={permanentlyDeleteDeletedFulfillmentOptionRow}
					{formatDeletedDate}
				/>
			</div>
		{/if}
	</div>
{/if}
