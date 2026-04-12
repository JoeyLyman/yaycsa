<script lang="ts">
	import { InputSelect, type InputSelectItem } from '$lib/components/blocks/input-select';

	let {
		/** All available allergen warning options. */
		items,
		/** Currently selected allergen warning IDs for this row. */
		selectedValues,
		/** Optional callback fired whenever the selection changes. */
		onchange,
		/** Optional callback fired when focus leaves the entire InputSelect. */
		onfocusleave,
		/** Whether the selector is disabled. */
		disabled = false,
		/** Whether the selected pills should be hidden above the input. */
		hidePills = false,
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
	multiSelect={true}
	color="orange"
	displayName={(item) => item.label.replace(/^May contain /i, '')}
	{placeholder}
	class={className}
/>
