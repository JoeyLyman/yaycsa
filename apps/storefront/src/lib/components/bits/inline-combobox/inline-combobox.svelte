<script lang="ts" module>
	/** Shape of an option rendered in the dropdown. */
	export interface InlineComboboxItem {
		value: string;
		label: string;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { Popover } from 'bits-ui';
	import { cn } from '$lib/components/utils.js';

	let {
		/** All selectable options, rendered in order. The dropdown filters against `label`. */
		items,
		/** Current value. Empty string means no selection. */
		value = '',
		/** Placeholder text shown when no value is selected. */
		placeholder = '',
		/** Whether the combobox is disabled. */
		disabled = false,
		/** Optional width class for the trigger input (e.g. `w-20`, `w-24`). */
		class: className = '',
		/** When true, an empty value renders the placeholder in destructive color as a required-field cue. */
		required = false,
		/** Callback fired when the seller picks an option. */
		onchange
	}: {
		items: InlineComboboxItem[];
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
		required?: boolean;
		onchange?: (nextValue: string) => void;
	} = $props();

	/** Whether the dropdown popover is currently open. */
	let open = $state(false);

	/** Text typed into the input while the popover is open; used to filter the option list. */
	let searchText = $state('');

	/** Index of the option that would be selected by pressing Enter. Reset when the popover opens. */
	let highlightedIndex = $state(0);

	/** Reference to the search input rendered inside the popover content. */
	let searchInputElement = $state<HTMLInputElement | null>(null);

	/** Focus the search input once the popover is open so typing filters immediately. */
	$effect(() => {
		if (open) {
			tick().then(() => searchInputElement?.focus());
		}
	});

	/** Resolved label for the current value. Empty string triggers placeholder rendering, even if a clear option exists. */
	let selectedLabel = $derived(
		value === '' ? '' : (items.find((item) => item.value === value)?.label ?? '')
	);

	/** Items visible in the dropdown after filtering by the current search text. */
	let filteredItems = $derived.by(() => {
		const query = searchText.trim().toLowerCase();
		if (query.length === 0) return items;
		return items.filter((item) => item.label.toLowerCase().includes(query));
	});

	/** Reset the highlighted index whenever the visible option list changes. */
	$effect(() => {
		filteredItems;
		highlightedIndex = 0;
	});

	function openPopover() {
		if (disabled) return;
		open = true;
		searchText = '';
		highlightedIndex = Math.max(
			0,
			items.findIndex((item) => item.value === value)
		);
	}

	function closePopover() {
		open = false;
		searchText = '';
	}

	function selectItem(nextValue: string) {
		onchange?.(nextValue);
		closePopover();
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			openPopover();
			return;
		}

		if (!open) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			closePopover();
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, filteredItems.length - 1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const item = filteredItems[highlightedIndex];
			if (item) selectItem(item.value);
			return;
		}
	}
</script>

<Popover.Root bind:open onOpenChange={(nextOpen) => (nextOpen ? openPopover() : closePopover())}>
	<Popover.Trigger
		class={cn(
			'cursor-pointer border-0 bg-transparent px-1 py-0 text-sm outline-none transition-colors',
			'hover:text-primary',
			disabled && 'cursor-not-allowed opacity-60',
			!value && !open && (required ? 'text-destructive/80' : 'text-muted-foreground/70'),
			className
		)}
		{disabled}
	>
		{#if open}
			<!-- Unfocused placeholder in the trigger while the popover is open; the real search input lives in the content. -->
			<span>{searchText || selectedLabel || placeholder}</span>
		{:else}
			<span>{selectedLabel || placeholder}</span>
		{/if}
	</Popover.Trigger>

	<Popover.Portal>
		<Popover.Content
			sideOffset={4}
			class="bg-popover text-popover-foreground z-50 w-56 rounded-md border p-1 shadow-md"
		>
			<input
				bind:this={searchInputElement}
				type="text"
				class="mb-1 h-7 w-full rounded-sm border border-input bg-background px-2 text-sm outline-none focus-visible:ring-ring/50 focus-visible:ring-2"
				{placeholder}
				value={searchText}
				oninput={(event) => (searchText = (event.currentTarget as HTMLInputElement).value)}
				onkeydown={handleInputKeydown}
			/>

			<div class="max-h-60 overflow-y-auto" role="listbox">
				{#each filteredItems as item, index (item.value)}
					<button
						type="button"
						role="option"
						aria-selected={item.value === value}
						class={cn(
							'flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none',
							index === highlightedIndex && 'bg-accent text-accent-foreground',
							item.value === value && 'font-medium'
						)}
						onmouseenter={() => (highlightedIndex = index)}
						onclick={() => selectItem(item.value)}
					>
						{item.label}
					</button>
				{/each}

				{#if filteredItems.length === 0}
					<div class="px-2 py-1.5 text-sm text-muted-foreground">No matches</div>
				{/if}
			</div>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
