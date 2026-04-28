<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import type {
		SellerFulfillmentOptionWorkspaceItem,
		SellerOfferWorkspaceItem
	} from '$lib/api/admin/offers.remote';
	import FulfillmentOptionListRowDraft from './fulfillment-option-list-row-draft.svelte';
	import FulfillmentOptionListRow from './fulfillment-option-list-row.svelte';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';
	import type { TableDetailMode } from '$lib/components/blocks/table-detail-toggle';
	import {
		deriveFulfillmentOptionUsage,
		getFulfillmentOptionTypeLabel,
		getUsageForOption,
		getWeekdayShortLabel,
		summarizeFulfillmentOptionUsage
	} from './fulfillment-option-list-helpers';
	import type {
		FulfillmentOptionEditorRow,
		FulfillmentOptionMutationInput
	} from './fulfillment-option-list-types';

	let {
		/** Saved fulfillment options (already filtered + sorted). */
		rows,
		/** Active draft slot keys. Each renders a draft row with its own local state. */
		draftKeys,
		/** Soft-deleted fulfillment options to render below the active list (already filtered). */
		deletedRows = [],
		/** Whether to render the deleted section. */
		showDeleted = false,
		/** Offers used to derive per-option usage counts. */
		offers,
		/** Global metadata visibility mode. Drives summary↔expanded for each saved row's metadata. */
		metadataMode = 'summary',
		/** IDs currently in the middle of a mutation. */
		pendingRowIds,
		/** Row-level error messages keyed by fulfillment option id or draft key. */
		rowErrors,
		/** Saved-row IDs currently showing their delete confirmation. */
		confirmingDeleteIds,
		/** Deleted-row IDs currently showing their permanent-delete confirmation. */
		confirmingPermanentDeleteIds,
		/** Save an existing saved row. */
		onsaveRow,
		/** Begin delete confirmation for a saved row. */
		onbegindelete,
		/** Cancel delete confirmation for a saved row. */
		oncanceldelete,
		/** Confirm delete for a saved row (handles permanent delete branching internally). */
		onconfirmdelete,
		/** Create a new fulfillment option from a draft. */
		oncreateDraft,
		/** Cancel a draft slot. */
		oncancelDraft,
		/** Add a new blank draft slot. */
		onadddraft,
		/** Restore a soft-deleted row. */
		onrestoreDeleted,
		/** Begin permanent-delete confirmation for a soft-deleted row. */
		onbeginpermanentdelete,
		/** Cancel permanent-delete confirmation for a soft-deleted row. */
		oncancelpermanentdelete,
		/** Confirm permanent delete for a soft-deleted row. */
		onconfirmpermanentdelete,
		/** Format the deletedAt timestamp for display. */
		formatDeletedDate
	}: {
		rows: FulfillmentOptionEditorRow[];
		draftKeys: string[];
		deletedRows?: SellerFulfillmentOptionWorkspaceItem[];
		showDeleted?: boolean;
		offers: SellerOfferWorkspaceItem[];
		metadataMode?: TableDetailMode;
		pendingRowIds: Set<string>;
		rowErrors: Map<string, string>;
		confirmingDeleteIds: Set<string>;
		confirmingPermanentDeleteIds: Set<string>;
		onsaveRow: (id: string, payload: FulfillmentOptionMutationInput) => Promise<void>;
		onbegindelete: (id: string) => void;
		oncanceldelete: (id: string) => void;
		onconfirmdelete: (id: string) => Promise<void>;
		oncreateDraft: (draftKey: string, payload: FulfillmentOptionMutationInput) => Promise<void>;
		oncancelDraft: (draftKey: string) => void;
		onadddraft: () => void;
		onrestoreDeleted: (id: string) => Promise<void>;
		onbeginpermanentdelete: (id: string) => void;
		oncancelpermanentdelete: (id: string) => void;
		onconfirmpermanentdelete: (row: SellerFulfillmentOptionWorkspaceItem) => Promise<void>;
		formatDeletedDate: (isoTimestamp: string | null) => string;
	} = $props();

	/** Shared edit-mode context set by the parent route. Null when the list is used standalone. */
	const tableEditModeContext = getTableEditModeContext();

	/** Whether the table is currently in edit mode. Defaults to true when no context is set. */
	let editMode = $derived(tableEditModeContext ? tableEditModeContext.editMode() : true);

	/** Usage map derived from offers — per fulfillment option id. */
	let usageMap = $derived(deriveFulfillmentOptionUsage(offers));

	/** Rows passed to name-uniqueness validation on each row (saved + draft working copies minus self). */
	let otherRowsForValidation = $derived(
		[...rows, ...draftKeys.map((draftKey) => ({ id: draftKey, name: '' }) as FulfillmentOptionEditorRow)]
	);
</script>

<div class="rounded-md border">
	{#if rows.length === 0 && draftKeys.length === 0 && (!showDeleted || deletedRows.length === 0)}
		<p class="px-4 py-6 text-sm text-muted-foreground">
			No fulfillment options yet. Add one below to give buyers a way to receive their orders.
		</p>
	{:else}
		{#each rows as row (row.id)}
			<FulfillmentOptionListRow
				snapshot={row}
				otherRows={otherRowsForValidation.filter((otherRow) => otherRow.id !== row.id)}
				usage={getUsageForOption(usageMap, row.id)}
				isPending={pendingRowIds.has(row.id)}
				confirmingDelete={confirmingDeleteIds.has(row.id)}
				error={rowErrors.get(row.id) ?? null}
				{metadataMode}
				onsave={onsaveRow}
				{onbegindelete}
				{oncanceldelete}
				{onconfirmdelete}
			/>
		{/each}

		{#if editMode}
			{#each draftKeys as draftKey (draftKey)}
				<FulfillmentOptionListRowDraft
					{draftKey}
					otherRows={otherRowsForValidation.filter((otherRow) => otherRow.id !== draftKey)}
					isPending={pendingRowIds.has(draftKey)}
					error={rowErrors.get(draftKey) ?? null}
					oncreate={oncreateDraft}
					oncancel={oncancelDraft}
				/>
			{/each}
		{/if}

		{#if showDeleted && deletedRows.length > 0}
			<div
				class="border-t bg-muted/10 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Deleted
			</div>
			{#each deletedRows as fulfillmentOption (fulfillmentOption.id)}
				<div class="border-b last:border-b-0">
					<div class="flex items-start gap-3 px-3 py-3 md:px-4">
						<div class="min-w-0 flex-1 space-y-1">
							<p class="truncate text-[17px] font-medium leading-tight">
								{fulfillmentOption.name}
							</p>
							<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
								<span>{getFulfillmentOptionTypeLabel(fulfillmentOption.type)}</span>
								{#if fulfillmentOption.fulfillmentWeekday}
									<span>{getWeekdayShortLabel(fulfillmentOption.fulfillmentWeekday)}</span>
								{/if}
								<span
									>{summarizeFulfillmentOptionUsage({
										offerCount: fulfillmentOption.offerCount,
										activeOfferCount: fulfillmentOption.activeOfferCount
									})}</span
								>
								<span>Deleted {formatDeletedDate(fulfillmentOption.deletedAt)}</span>
							</div>
							{#if fulfillmentOption.notes}
								<p class="text-sm text-muted-foreground">{fulfillmentOption.notes}</p>
							{/if}
							{#if rowErrors.get(fulfillmentOption.id)}
								<p class="text-xs text-destructive">{rowErrors.get(fulfillmentOption.id)}</p>
							{/if}
						</div>
						<div class="shrink-0">
							<div class="flex flex-wrap items-center justify-end gap-1">
								<Button
									size="sm"
									variant="outline"
									disabled={pendingRowIds.has(fulfillmentOption.id)}
									onclick={() => onrestoreDeleted(fulfillmentOption.id)}
								>
									{#if pendingRowIds.has(fulfillmentOption.id)}
										<SpinnerSun class="size-3.5" />
									{:else}
										Restore
									{/if}
								</Button>
								{#if confirmingPermanentDeleteIds.has(fulfillmentOption.id)}
									<Button
										size="sm"
										variant="destructive"
										disabled={pendingRowIds.has(fulfillmentOption.id) ||
											!fulfillmentOption.canPermanentlyDelete}
										onclick={() => onconfirmpermanentdelete(fulfillmentOption)}
									>
										Permanently Delete
									</Button>
									<Button
										size="sm"
										variant="ghost"
										class="-mr-2"
										onclick={() => oncancelpermanentdelete(fulfillmentOption.id)}
									>
										Cancel
									</Button>
								{:else}
									<Button
										size="sm"
										variant="ghost"
										disabled={!fulfillmentOption.canPermanentlyDelete}
										onclick={() => onbeginpermanentdelete(fulfillmentOption.id)}
									>
										Permanently Delete
									</Button>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	{/if}
</div>

{#if editMode}
	<Button
		variant="outline"
		class="mt-3 w-full"
		onclick={onadddraft}
		data-testid="add-fulfillment-option-button"
	>
		+ Add Fulfillment Option
	</Button>
{/if}
