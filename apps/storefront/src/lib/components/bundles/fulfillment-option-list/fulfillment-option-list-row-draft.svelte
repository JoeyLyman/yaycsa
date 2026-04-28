<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { HeaderTabs } from '$lib/components/bits/header-tabs';
	import { Input } from '$lib/components/bits/input';
	import { TableRowEditActions } from '$lib/components/blocks/table-row-edit-actions';
	import type { FulfillmentOptionType } from '$lib/api/admin/fulfillment-options.remote';
	import FulfillmentOptionListRowMetadata from './fulfillment-option-list-row-metadata.svelte';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';
	import {
		buildTypePatch,
		createBlankFulfillmentOptionEditorRow,
		getRowValidationErrors,
		rowToMutationInput
	} from './fulfillment-option-list-helpers';
	import {
		fulfillmentOptionTypeOptions,
		type FulfillmentOptionEditorRow,
		type FulfillmentOptionMutationInput
	} from './fulfillment-option-list-types';

	let {
		/** Stable key used to track this draft slot across renders. */
		draftKey,
		/** Other editor rows (saved + other drafts) used for name-uniqueness validation. */
		otherRows,
		/** Whether this draft is currently being created (mutation in flight). */
		isPending = false,
		/** Error message from the last create attempt. */
		error,
		/** Create the fulfillment option with the draft's payload. */
		oncreate,
		/** Cancel and remove this draft slot. */
		oncancel
	}: {
		draftKey: string;
		otherRows: FulfillmentOptionEditorRow[];
		isPending?: boolean;
		error?: string | null;
		oncreate: (draftKey: string, payload: FulfillmentOptionMutationInput) => Promise<void>;
		oncancel: (draftKey: string) => void;
	} = $props();

	/** Local working copy of this draft's editor state. Initialized blank with id = draftKey. */
	let workingRow = $state<FulfillmentOptionEditorRow>(
		untrack(() => createBlankFulfillmentOptionEditorRow(draftKey))
	);

	/** Reference to the name input so we can autofocus on first render. */
	let nameInputElement = $state<HTMLInputElement | null>(null);

	/** Autofocus the name field when this draft first mounts. */
	$effect(() => {
		tick().then(() => {
			nameInputElement?.focus();
		});
	});

	/** Shared edit-mode context. Draft rows always count as dirty while mounted. */
	const tableEditModeContext = getTableEditModeContext();

	$effect(() => {
		if (!tableEditModeContext) return;
		tableEditModeContext.registerDirty(draftKey, true);
		return () => tableEditModeContext.unregisterDirty(draftKey);
	});

	/** Client-side validation errors for this draft. */
	let validationErrors = $derived(getRowValidationErrors(workingRow, otherRows));

	/**
	 * Whether this draft's create mutation is in flight.
	 * Driven locally so the spinner flips synchronously the moment the seller clicks Save.
	 */
	let saving = $state(false);

	/** Whether the draft row should render as actively mutating. */
	let mutating = $derived(saving || isPending);

	/** Whether the draft is minimally filled-in enough to allow a submit attempt. */
	let canSave = $derived(
		workingRow.name.trim().length >= 2 && validationErrors.length === 0 && !mutating
	);

	/** Apply a patch to the working draft row. */
	function patchWorkingRow(patch: Partial<FulfillmentOptionEditorRow>) {
		workingRow = { ...workingRow, ...patch };
	}

	function handleTypeSelect(nextValue: string) {
		patchWorkingRow(buildTypePatch(nextValue as FulfillmentOptionType));
	}

	async function handleCreate() {
		if (!canSave) return;
		saving = true;
		try {
			await oncreate(draftKey, rowToMutationInput(workingRow));
		} finally {
			saving = false;
		}
	}
</script>

<div
	data-fulfillment-option-draft-row
	data-row-id={draftKey}
	class="border-b bg-muted/20 last:border-b-0 {mutating ? 'opacity-60' : ''}"
>
	<div
		class="flex min-h-11 flex-wrap items-start gap-2 px-3 pt-3 pb-2 md:gap-3 md:px-4 md:pt-4 md:pb-3"
	>
		<div class="flex min-w-0 flex-1 flex-col gap-5">
			<Input
				bind:ref={nameInputElement}
				class="h-8 w-full min-w-0 text-[17px] leading-tight font-medium"
				placeholder="Fulfillment option name"
				value={workingRow.name}
				disabled={mutating}
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
			<TableRowEditActions
				{saving}
				{canSave}
				onsave={handleCreate}
				oncancel={() => oncancel(draftKey)}
			/>
		</div>
	</div>

	{#if error}
		<p class="px-3 pb-1 text-xs text-destructive md:px-4">{error}</p>
	{/if}

	<FulfillmentOptionListRowMetadata
		row={workingRow}
		disabled={mutating}
		editMode={true}
		onPatch={patchWorkingRow}
	/>
</div>
