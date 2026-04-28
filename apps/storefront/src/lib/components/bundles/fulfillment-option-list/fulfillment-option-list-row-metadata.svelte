<script lang="ts">
	import { InlineCombobox, type InlineComboboxItem } from '$lib/components/bits/inline-combobox';
	import { Textarea } from '$lib/components/bits/textarea';
	import { TableMetaRow } from '$lib/components/blocks/table-meta-row';
	import {
		isScheduledFulfillmentOptionType,
		summarizeNotes,
		timeOfDayOptions
	} from './fulfillment-option-list-helpers';
	import { weekdayOptions, type FulfillmentOptionEditorRow } from './fulfillment-option-list-types';

	let {
		/** The editor row being edited. */
		row,
		/** Whether the whole row is in a read-only/pending state. */
		disabled = false,
		/** Whether the parent table is in edit mode. Drives whether editors are interactive and whether Notes is forced open. */
		editMode = true,
		/** Patch the editor row with field-level changes. */
		onPatch
	}: {
		row: FulfillmentOptionEditorRow;
		disabled?: boolean;
		editMode?: boolean;
		onPatch: (patch: Partial<FulfillmentOptionEditorRow>) => void;
	} = $props();

	/** Clear option shown at the top of every combobox so sellers can empty a field. */
	const clearOption: InlineComboboxItem = { value: '', label: '—' };

	/** Weekday options for the inline combobox, including a blank/clear choice. */
	const weekdayComboboxItems: InlineComboboxItem[] = [
		clearOption,
		...weekdayOptions.map((weekday) => ({ value: weekday.value, label: weekday.label }))
	];

	/** Time-of-day options for the inline combobox, including a blank/clear choice. */
	const timeComboboxItems: InlineComboboxItem[] = [clearOption, ...timeOfDayOptions];

	/** Whether this row uses a scheduled fulfillment window (pickup or delivery). */
	let isScheduled = $derived(isScheduledFulfillmentOptionType(row.type));

	/** Label for the scheduled-window meta row, shifted to match the seller's chosen type. */
	let fulfillmentWindowLabel = $derived(
		row.type === 'scheduled_delivery' ? 'Delivery Window' : 'Pickup Window'
	);

	/** Human-readable summary for the notes meta row. */
	let notesSummary = $derived(summarizeNotes(row.notes));

	/** Whether to keep the Notes editor mounted regardless of toggle state. */
	let notesAlwaysOpen = $derived(editMode);

	/** Handle order-deadline weekday changes. For shipping, clearing the weekday also clears the time. */
	function handleOrderDeadlineWeekdayChange(nextValue: string) {
		const typedValue = nextValue as FulfillmentOptionEditorRow['orderDeadlineWeekday'];
		if (row.type === 'shipping' && nextValue === '') {
			onPatch({ orderDeadlineWeekday: '', orderDeadlineTime: '' });
			return;
		}
		onPatch({ orderDeadlineWeekday: typedValue });
	}
</script>

<div class="-mt-[11px] space-y-0.5 overflow-visible px-3 pb-2.5 text-xs md:px-4 md:pb-4">
	{#if isScheduled}
		<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
			<span class="italic text-muted-foreground">{fulfillmentWindowLabel}</span>
			<InlineCombobox
				items={weekdayComboboxItems}
				value={row.fulfillmentWeekday}
				placeholder="day"
				{disabled}
				interactive={editMode}
				required
				class="w-24"
				onchange={(nextValue) =>
					onPatch({
						fulfillmentWeekday: nextValue as FulfillmentOptionEditorRow['fulfillmentWeekday']
					})}
			/>
			<InlineCombobox
				items={timeComboboxItems}
				value={row.fulfillmentTimeWindowStart}
				placeholder="start time"
				{disabled}
				interactive={editMode}
				required
				class="w-24"
				onchange={(nextValue) => onPatch({ fulfillmentTimeWindowStart: nextValue })}
			/>
			<span class="text-muted-foreground">–</span>
			<InlineCombobox
				items={timeComboboxItems}
				value={row.fulfillmentTimeWindowEnd}
				placeholder="end time"
				{disabled}
				interactive={editMode}
				required
				class="w-24"
				onchange={(nextValue) => onPatch({ fulfillmentTimeWindowEnd: nextValue })}
			/>
		</div>
	{/if}

	<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
		<span class="italic text-muted-foreground">
			Order Deadline{row.type === 'shipping' ? ' (optional)' : ''}
		</span>
		<InlineCombobox
			items={weekdayComboboxItems}
			value={row.orderDeadlineWeekday}
			placeholder="day"
			{disabled}
			interactive={editMode}
			required={isScheduled}
			class="w-24"
			onchange={handleOrderDeadlineWeekdayChange}
		/>
		<InlineCombobox
			items={timeComboboxItems}
			value={row.orderDeadlineTime}
			placeholder="time"
			{disabled}
			interactive={editMode}
			required={isScheduled}
			class="w-24"
			onchange={(nextValue) => onPatch({ orderDeadlineTime: nextValue })}
		/>
	</div>

	<TableMetaRow
		label="Notes"
		summary={notesSummary}
		open={notesAlwaysOpen}
		disabled={disabled || notesAlwaysOpen}
	>
		{#snippet editor()}
			<div class="max-w-md py-2">
				<Textarea
					value={row.notes}
					placeholder="Optional notes visible to buyers"
					rows={3}
					oninput={(event) =>
						onPatch({ notes: (event.currentTarget as HTMLTextAreaElement).value })}
				/>
			</div>
		{/snippet}
	</TableMetaRow>
</div>
