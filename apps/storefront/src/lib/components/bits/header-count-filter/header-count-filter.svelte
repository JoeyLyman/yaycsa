<script lang="ts">
	import { cn } from '$lib/components/utils.js';

	type HeaderCountFilterValue = 'active' | 'total';

	let {
		/** Count shown for the active-only filter tab. */
		activeCount,
		/** Count shown for the total/all filter tab. */
		totalCount,
		/** The filter currently selected by the parent view. */
		selectedValue,
		/** Callback fired when the user switches between active and total. */
		onselect,
		/** Accessible label announced for this compact filter tab group. */
		ariaLabel = 'Count filters',
		/** Optional extra classes for layout tweaks from the parent. */
		class: className
	}: {
		activeCount: number;
		totalCount: number;
		selectedValue: HeaderCountFilterValue;
		onselect: (value: HeaderCountFilterValue) => void;
		ariaLabel?: string;
		class?: string;
	} = $props();

	function isSelected(value: HeaderCountFilterValue): boolean {
		return value === selectedValue;
	}

	function getItemClasses(value: HeaderCountFilterValue): string {
		if (isSelected(value)) {
			return 'cursor-default text-foreground';
		}

		return 'text-muted-foreground/60 transition-colors hover:text-muted-foreground';
	}
</script>

<nav aria-label={ariaLabel} class={cn('flex items-center text-2xl font-normal', className)}>
	<button
		type="button"
		class={cn('border-0 bg-transparent p-0 text-left', getItemClasses('active'))}
		aria-pressed={isSelected('active')}
		onclick={() => onselect('active')}
	>
		{activeCount} active
	</button>
	<span aria-hidden="true" class="mx-2 text-foreground">&middot;</span>
	<button
		type="button"
		class={cn('border-0 bg-transparent p-0 text-left', getItemClasses('total'))}
		aria-pressed={isSelected('total')}
		onclick={() => onselect('total')}
	>
		{totalCount} total
	</button>
</nav>
