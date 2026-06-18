<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import * as DropdownMenu from '$lib/components/bits/dropdown-menu';
	import { cn } from '$lib/components/utils.js';
	import type { TableStatusFilterOption } from './table-status-filter-types';

	let {
		/** The options offered in the dropdown, in display order. */
		options,
		/**
		 * The currently-checked option values. Bindable so the parent owns the
		 * filter state and can derive the visible rows from it.
		 */
		selected = $bindable(),
		/** Optional change notification fired after a toggle, with the next selection. */
		onchange,
		/** Trigger label shown on the button (e.g. 'Status'). */
		label = 'Status',
		/** Accessible label announced for the trigger button. */
		ariaLabel = 'Filter by status',
		/** Optional extra classes for layout tweaks from the parent. */
		class: className
	}: {
		options: TableStatusFilterOption[];
		selected: string[];
		onchange?: (selected: string[]) => void;
		label?: string;
		ariaLabel?: string;
		class?: string;
	} = $props();

	/**
	 * Whether the current selection narrows the list — true when at least one
	 * option is unchecked. Drives the count badge so the trigger signals an
	 * active filter at a glance without taking extra space.
	 */
	let isNarrowed = $derived(selected.length < options.length);

	/** Whether a given option value is currently checked. */
	function isChecked(value: string): boolean {
		return selected.includes(value);
	}

	/** Toggle an option on/off and notify the parent with the new selection. */
	function toggle(value: string, checked: boolean) {
		const next = checked
			? [...selected, value]
			: selected.filter((entry) => entry !== value);
		selected = next;
		onchange?.(next);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				size="sm"
				variant="outline"
				class={cn('h-7 gap-1 px-2 text-xs text-muted-foreground', className)}
				aria-label={ariaLabel}
			>
				<span>{label}</span>
				{#if isNarrowed}
					<span
						class="rounded-sm bg-muted px-1 text-[10px] font-medium tabular-nums text-foreground"
					>
						{selected.length}
					</span>
				{/if}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="translate-y-px"
					aria-hidden="true"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-auto min-w-44">
		{#each options as option (option.value)}
			<DropdownMenu.CheckboxItem
				checked={isChecked(option.value)}
				closeOnSelect={false}
				onCheckedChange={(checked) => toggle(option.value, checked)}
			>
				<span>{option.label}</span>
				{#if option.count !== undefined}
					<span class="ml-auto mr-1 text-muted-foreground tabular-nums">{option.count}</span>
				{/if}
			</DropdownMenu.CheckboxItem>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
