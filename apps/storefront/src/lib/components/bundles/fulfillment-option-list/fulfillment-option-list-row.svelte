<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/bits/button';
	import { HeaderTabs } from '$lib/components/bits/header-tabs';
	import { Input } from '$lib/components/bits/input';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import type { FulfillmentOptionType } from '$lib/api/admin/fulfillment-options.remote';
	import FulfillmentOptionListRowMetadata from './fulfillment-option-list-row-metadata.svelte';
	import {
		buildTypePatch,
		getRowValidationErrors,
		isRowDirty,
		rowToMutationInput
	} from './fulfillment-option-list-helpers';
	import {
		fulfillmentOptionTypeOptions,
		type FulfillmentOptionEditorRow,
		type FulfillmentOptionMutationInput,
		type FulfillmentOptionUsage
	} from './fulfillment-option-list-types';

	type MetaField = 'notes';

	let {
		/** The saved fulfillment-option snapshot from the server. */
		snapshot,
		/** Other editor rows (saved + draft) used for name-uniqueness validation. */
		otherRows,
		/** Usage counts derived from loaded offers. */
		usage,
		/** Whether this row is currently mutating (save/delete/restore in flight). */
		isPending = false,
		/** Whether this row has a delete confirmation currently open. */
		confirmingDelete = false,
		/** Error message from the last mutation attempt. */
		error,
		/** Save the row with a mutation payload. */
		onsave,
		/** Begin the delete confirmation flow. */
		onbegindelete,
		/** Cancel a delete confirmation. */
		oncanceldelete,
		/** Confirm and execute the delete. */
		onconfirmdelete
	}: {
		snapshot: FulfillmentOptionEditorRow;
		otherRows: FulfillmentOptionEditorRow[];
		usage: FulfillmentOptionUsage;
		isPending?: boolean;
		confirmingDelete?: boolean;
		error?: string | null;
		onsave: (id: string, payload: FulfillmentOptionMutationInput) => Promise<void>;
		onbegindelete: (id: string) => void;
		oncanceldelete: (id: string) => void;
		onconfirmdelete: (id: string) => Promise<void>;
	} = $props();

	/** Local working copy of this row's editor state. Starts as a clone of the server snapshot. */
	let workingRow = $state<FulfillmentOptionEditorRow>(
		untrack(() => $state.snapshot(snapshot)) as FulfillmentOptionEditorRow
	);

	/** The id of the last snapshot we reset from. Used to detect server refreshes. */
	let lastSnapshotId = untrack(() => snapshot.id);

	/** Which meta-row inline editor is currently open (null = none). */
	let activeField: MetaField | null = $state(null);

	/** Reset the working row when the server-provided snapshot changes identity. */
	$effect(() => {
		if (snapshot.id !== lastSnapshotId) {
			workingRow = $state.snapshot(snapshot) as FulfillmentOptionEditorRow;
			activeField = null;
			lastSnapshotId = snapshot.id;
		}
	});

	/** Whether the working row has pending edits vs the snapshot. */
	let dirty = $derived(isRowDirty(workingRow, snapshot));

	/** Client-side validation errors on the current working row. */
	let validationErrors = $derived(getRowValidationErrors(workingRow, otherRows));

	/** Whether the Save button should be enabled. */
	let canSave = $derived(dirty && validationErrors.length === 0 && !isPending);

	/** Whether the delete button should be labeled "Permanently Delete". */
	let canPermanentlyDelete = $derived(usage.offerCount === 0);

	/** Apply a patch to the working row. */
	function patchWorkingRow(patch: Partial<FulfillmentOptionEditorRow>) {
		workingRow = { ...workingRow, ...patch };
	}

	/** Handle a tab-level type change (clears schedule fields when switching to shipping). */
	function handleTypeSelect(nextValue: string) {
		patchWorkingRow(buildTypePatch(nextValue as FulfillmentOptionType));
	}

	/** Toggle a meta-row inline editor. */
	function handleToggleField(field: MetaField) {
		activeField = activeField === field ? null : field;
	}

	/** Discard all local edits and close open editors. */
	function handleCancel() {
		workingRow = $state.snapshot(snapshot) as FulfillmentOptionEditorRow;
		activeField = null;
	}

	/** Submit the accumulated edits via the parent save callback. */
	async function handleSave() {
		if (!canSave) return;
		await onsave(snapshot.id, rowToMutationInput(workingRow));
	}
</script>

<div
	data-fulfillment-option-row
	data-row-id={snapshot.id}
	class="border-b last:border-b-0 {isPending ? 'opacity-60' : ''}"
>
	<div
		class="flex min-h-11 flex-wrap items-start gap-2 px-3 pt-3 pb-2 md:gap-3 md:px-4 md:pt-4 md:pb-3"
	>
		<div class="flex min-w-0 flex-1 flex-col gap-3">
			<Input
				class="h-8 w-full min-w-0 text-[17px] font-medium leading-tight"
				value={workingRow.name}
				disabled={isPending}
				oninput={(event) =>
					patchWorkingRow({ name: (event.currentTarget as HTMLInputElement).value })}
			/>
			<HeaderTabs
				size="sm"
				ariaLabel="Fulfillment option type"
				selectedValue={workingRow.type}
				items={fulfillmentOptionTypeOptions.map((option) => ({
					value: option.value,
					label: option.label,
					disabled: isPending
				}))}
				onselect={handleTypeSelect}
			/>
		</div>

		<div class="shrink-0">
			{#if dirty}
				<div class="flex items-center gap-1">
					<Button size="sm" disabled={!canSave} onclick={handleSave}>
						{#if isPending}<SpinnerSun class="size-3.5" />{:else}Save{/if}
					</Button>
					<Button size="sm" variant="ghost" disabled={isPending} onclick={handleCancel}>
						Cancel
					</Button>
				</div>
			{:else if confirmingDelete}
				<div class="flex items-center gap-1">
					<Button
						size="sm"
						variant="destructive"
						disabled={isPending}
						onclick={() => onconfirmdelete(snapshot.id)}
					>
						{#if isPending}
							<SpinnerSun class="size-3.5" />
						{:else}
							{canPermanentlyDelete ? 'Permanently Delete' : 'Delete'}
						{/if}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={isPending}
						onclick={() => oncanceldelete(snapshot.id)}
					>
						Cancel
					</Button>
				</div>
			{:else}
				<Button
					size="sm"
					variant="ghost"
					disabled={isPending}
					onclick={() => onbegindelete(snapshot.id)}
				>
					Delete
				</Button>
			{/if}
		</div>
	</div>

	{#if error}
		<p class="px-3 pb-1 text-xs text-destructive md:px-4">{error}</p>
	{/if}

	<FulfillmentOptionListRowMetadata
		row={workingRow}
		{activeField}
		disabled={isPending}
		onToggleField={handleToggleField}
		onPatch={patchWorkingRow}
	/>
</div>
