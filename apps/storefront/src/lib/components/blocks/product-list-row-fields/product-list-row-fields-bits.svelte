<script lang="ts">
	import { InputSelect, type InputSelectItem } from '$lib/components/blocks/input-select';

	let {
		/** All available ingredient / component options. */
		items,
		/** Currently selected bit IDs for this row. */
		selectedValues,
		/** Optional callback fired whenever the selection changes. */
		onchange,
		/** Optional callback fired when focus leaves the entire InputSelect. */
		onfocusleave,
		/** Whether the selector is disabled. */
		disabled = false,
		/** Whether the selected pills should be hidden above the input. */
		hidePills = false,
		/** Callback to create a new ingredient when no exact match exists. */
		onCreate,
		/** Placeholder text shown inside the search input. */
		placeholder = 'Search...',
		/** Optional extra classes for the InputSelect wrapper. */
		class: className = ''
	}: {
		items: InputSelectItem[];
		selectedValues: string[];
		onchange?: (values: string[]) => void;
		onfocusleave?: () => void;
		disabled?: boolean;
		hidePills?: boolean;
		onCreate?: (name: string) => Promise<InputSelectItem | null>;
		placeholder?: string;
		class?: string;
	} = $props();
</script>

<InputSelect
	{items}
	{selectedValues}
	{onchange}
	{onfocusleave}
	{disabled}
	{hidePills}
	allowCreate={true}
	multiSelect={true}
	color="green"
	{onCreate}
	{placeholder}
	class={className}
/>
