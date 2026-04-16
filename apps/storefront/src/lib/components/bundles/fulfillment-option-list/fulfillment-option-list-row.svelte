<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { Button } from '$lib/components/bits/button';
	import { HeaderTabs } from '$lib/components/bits/header-tabs';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { TableRowHeader } from '$lib/components/blocks/table-row-header';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';
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

	/** Whether the row name is currently in input-editing mode. Only enters true in edit mode. */
	let editingName = $state(false);

	/** Reference to the name input so we can focus it when the seller opens the editor. */
	let nameInputEl: HTMLInputElement | null = $state(null);

	/** Shared edit-mode context from the parent list. Null when rendered standalone. */
	const tableEditModeContext = getTableEditModeContext();

	/** Whether the table is currently in edit mode. Defaults to true when no context is set. */
	let editMode = $derived(tableEditModeContext ? tableEditModeContext.editMode() : true);

	/** Reset the working row when the server-provided snapshot changes identity. */
	$effect(() => {
		if (snapshot.id !== lastSnapshotId) {
			workingRow = $state.snapshot(snapshot) as FulfillmentOptionEditorRow;
			activeField = null;
			editingName = false;
			lastSnapshotId = snapshot.id;
		}
	});

	/** Whether the working row has pending edits vs the snapshot. */
	let dirty = $derived(isRowDirty(workingRow, snapshot));

	/** Register/unregister this row's dirty state with the shared edit-mode context. */
	$effect(() => {
		if (!tableEditModeContext) return;
		tableEditModeContext.registerDirty(snapshot.id, dirty);
		return () => tableEditModeContext.unregisterDirty(snapshot.id);
	});

	/** Close the name editor when edit mode is turned off mid-edit. */
	$effect(() => {
		if (!editMode) {
			editingName = false;
			activeField = null;
		}
	});

	/** Open the name input and focus it after the DOM updates. */
	function openNameEditor() {
		if (!editMode) return;
		editingName = true;
		tick().then(() => nameInputEl?.focus());
	}

	/** Close the name input without discarding edits. */
	function closeNameEditor() {
		editingName = false;
	}

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
		editingName = false;
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
			<TableRowHeader
				bind:ref={nameInputEl}
				value={workingRow.name}
				editing={editingName}
				disabled={isPending}
				onopenedit={editMode ? openNameEditor : undefined}
				oninput={(event) =>
					patchWorkingRow({ name: (event.currentTarget as HTMLInputElement).value })}
				onblur={closeNameEditor}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === 'Escape') {
						event.preventDefault();
						closeNameEditor();
					}
				}}
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
				onselect={editMode ? handleTypeSelect : undefined}
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
			{:else if editMode}
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
		{editMode}
		onToggleField={handleToggleField}
		onPatch={patchWorkingRow}
	/>
</div>
