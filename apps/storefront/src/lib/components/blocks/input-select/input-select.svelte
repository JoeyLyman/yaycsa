<script lang="ts" module>
	export interface InputSelectItem {
		value: string;
		label: string;
		group?: string | null;
	}
</script>

<script lang="ts">
	import { Input } from '$lib/components/bits/input';
	import { Badge } from '$lib/components/bits/badge';

	/**
	 * Color theme config for badges and checkboxes.
	 * Maps color names to Tailwind class fragments.
	 */
	const COLOR_CLASSES = {
		green: {
			badge: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-300',
			badgeHover: 'hover:bg-green-600/20',
			checkbox: 'border-green-600 bg-green-600',
		},
		blue: {
			badge: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
			badgeHover: 'hover:bg-blue-500/20',
			checkbox: 'border-blue-500 bg-blue-500',
		},
		orange: {
			badge: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
			badgeHover: 'hover:bg-orange-500/20',
			checkbox: 'border-orange-500 bg-orange-500',
		},
		neutral: {
			badge: 'border-border bg-muted text-foreground',
			badgeHover: 'hover:bg-muted/80',
			checkbox: 'border-primary bg-primary',
		},
	} as const;

	type ColorName = keyof typeof COLOR_CLASSES;

	let {
		/** All available options to pick from. */
		items,
		/** Currently selected values. Bindable — parent owns selection state. */
		selectedValues = $bindable([]),
		/** Whether multiple items can be selected (checkboxes) or just one (pick & close). */
		multiSelect = true,
		/** Color theme for badges and checkboxes. */
		color = 'neutral' as ColorName,
		/** Whether to show a "Create new" option when search has no exact match. */
		allowCreate = false,
		/** Callback to create a new item from the search term. */
		onCreate,
		/** Custom display name transform (e.g., strip prefixes). */
		displayName,
		/** Whether the input is disabled. */
		disabled = false,
		/** Max pills to show before "+N more". */
		maxVisible = 4,
		/** Placeholder text for the search input. */
		placeholder = 'Search...',
		/** Optional change callback (alternative to binding selectedValues). */
		onchange,
		/** Callback fired when focus leaves the entire InputSelect container. */
		onfocusleave,
		/** Hide the selected-item pills above the input (when parent renders them externally). */
		hidePills = false,
		/** Additional class for the outer container. */
		class: className = '',
	}: {
		items: InputSelectItem[];
		selectedValues: string[];
		multiSelect?: boolean;
		color?: ColorName;
		allowCreate?: boolean;
		onCreate?: (name: string) => Promise<InputSelectItem | null>;
		displayName?: (item: InputSelectItem) => string;
		disabled?: boolean;
		maxVisible?: number;
		placeholder?: string;
		onchange?: (values: string[]) => void;
		onfocusleave?: () => void;
		hidePills?: boolean;
		class?: string;
	} = $props();

	/** Whether the dropdown is open. */
	let open = $state(false);

	/** Current search query. */
	let searchQuery = $state('');

	/** Whether a new item is being created via the onCreate callback. */
	let creating = $state(false);

	/**
	 * Index of the currently highlighted item in the filtered list.
	 * -1 means nothing highlighted. Used for arrow-key navigation.
	 */
	let highlightedIndex = $state(-1);

	/** Reference to the container for click-outside detection. */
	let containerEl: HTMLDivElement | null = $state(null);

	/** Reference to the search input for re-focusing after selection. */
	let inputEl: HTMLInputElement | null = $state(null);

	/** Reference to the dropdown container for scrolling highlighted items into view. */
	let dropdownEl: HTMLDivElement | null = $state(null);

	/** Filtered items based on search query, capped at 50. */
	let filteredItems = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		const filtered = q
			? items.filter(
					(item) =>
						getDisplayName(item).toLowerCase().includes(q) ||
						(item.group ?? '').toLowerCase().includes(q)
				)
			: items;
		return filtered.slice(0, 50);
	});

	/**
	 * Normalize a name to Title Case, letters/numbers/spaces/ampersands only.
	 * Mirrors the server-side bit name normalization.
	 */
	function normalizeName(raw: string): string {
		return raw
			.replace(/[^a-zA-Z0-9\s&]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
	}

	/** The normalized search term for the "Create new" option. */
	let normalizedCreateName = $derived(
		allowCreate && searchQuery.trim().length >= 2 ? normalizeName(searchQuery) : ''
	);

	/**
	 * Whether the "Create new" option should be shown.
	 * True when allowCreate is on, search is long enough, and no exact match exists.
	 */
	let canCreate = $derived.by(() => {
		if (!normalizedCreateName) return false;
		return !items.some(
			(item) => getDisplayName(item).toLowerCase() === normalizedCreateName.toLowerCase()
		);
	});

	/** Get the display name for an item, using the custom transform if provided. */
	function getDisplayName(item: InputSelectItem): string {
		return displayName ? displayName(item) : item.label;
	}

	/** Get the selected items as full objects. */
	let selectedItems = $derived(
		items.filter((item) => selectedValues.includes(item.value))
	);

	/**
	 * Placeholder passed to the underlying text input.
	 * For closed single-selects with a chosen value, hide the placeholder so it does not overlap
	 * the overlaid selected label text.
	 */
	let inputPlaceholder = $derived(
		!multiSelect && selectedItems.length > 0 && !open ? '' : placeholder
	);

	/** Update selectedValues and fire onchange if provided. */
	function updateSelection(newValues: string[]) {
		selectedValues = newValues;
		onchange?.(newValues);
	}

	/** Toggle an item's selection. */
	function toggleItem(value: string) {
		if (multiSelect) {
			if (selectedValues.includes(value)) {
				updateSelection(selectedValues.filter((v) => v !== value));
			} else {
				updateSelection([...selectedValues, value]);
			}
		} else {
			updateSelection([value]);
			open = false;
			searchQuery = '';
		}
	}

	/** Remove a selected item (from pill click). */
	function removeItem(value: string) {
		updateSelection(selectedValues.filter((v) => v !== value));
	}

	/** Handle creating a new item via the onCreate callback. */
	async function handleCreate() {
		if (!onCreate || !normalizedCreateName) return;
		creating = true;
		try {
			const newItem = await onCreate(normalizedCreateName);
			if (newItem) {
				if (!selectedValues.includes(newItem.value)) {
					updateSelection([...selectedValues, newItem.value]);
				}
				searchQuery = '';
			}
		} catch (err) {
			console.error('Failed to create item:', err);
		}
		creating = false;
	}

	/**
	 * Reset highlighted index when the dropdown opens/closes or when
	 * the filtered items change (due to search query or items list change).
	 */
	$effect(() => {
		// Access both to register dependencies
		const len = filteredItems.length;
		if (open && len > 0) {
			highlightedIndex = 0;
		} else {
			highlightedIndex = -1;
		}
	});

	/** Scroll the highlighted item into view within the dropdown. */
	function scrollHighlightedIntoView() {
		if (!dropdownEl || highlightedIndex < 0) return;
		const items = dropdownEl.querySelectorAll('[data-item-index]');
		items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
	}

	/**
	 * Handle keyboard navigation in the search input.
	 * ArrowUp/Down navigate items, Enter selects, Escape closes.
	 * stopPropagation prevents table-level keydown handler from intercepting.
	 */
	function handleKeydown(e: KeyboardEvent) {
		if (!open) {
			// Open dropdown on ArrowDown when closed
			if (e.key === 'ArrowDown') {
				open = true;
				e.preventDefault();
				e.stopPropagation();
			}
			// For all other keys (ArrowUp, ArrowLeft, etc.), let them bubble to parent
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				if (highlightedIndex < filteredItems.length - 1) {
					e.preventDefault();
					e.stopPropagation();
					highlightedIndex++;
					scrollHighlightedIntoView();
				} else if (canCreate && highlightedIndex < filteredItems.length) {
					e.preventDefault();
					e.stopPropagation();
					highlightedIndex = filteredItems.length;
					scrollHighlightedIntoView();
				} else {
					// At bottom — close dropdown, let event bubble for table row navigation
					open = false;
					searchQuery = '';
				}
				break;

			case 'ArrowUp':
				if (highlightedIndex > 0) {
					e.preventDefault();
					e.stopPropagation();
					highlightedIndex--;
					scrollHighlightedIntoView();
				} else {
					// At top — close dropdown, let event bubble for table row navigation
					open = false;
					searchQuery = '';
				}
				break;

			case 'Enter':
				e.preventDefault();
				e.stopPropagation();
				if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
					const item = filteredItems[highlightedIndex];
					toggleItem(item.value);
					if (multiSelect) {
						searchQuery = '';
						inputEl?.focus();
					}
				} else if (highlightedIndex === filteredItems.length && canCreate) {
					handleCreate();
				}
				break;

			case 'Escape':
				e.preventDefault();
				e.stopPropagation();
				open = false;
				searchQuery = '';
				break;

			case 'Tab':
				// Let Tab propagate naturally but close dropdown
				open = false;
				searchQuery = '';
				break;

			default:
				// Don't stopPropagation for regular typing
				break;
		}
	}

	/** Close the dropdown when clicking outside the container. */
	function handleClickOutside(event: MouseEvent) {
		if (containerEl && !containerEl.contains(event.target as Node)) {
			open = false;
		}
	}

	/** Close dropdown when focus leaves the entire InputSelect container. */
	function handleFocusOut(e: FocusEvent) {
		const focusLeavingContainer = !e.relatedTarget || !containerEl?.contains(e.relatedTarget as Node);
		if (focusLeavingContainer) {
			open = false;
			searchQuery = '';
			onfocusleave?.();
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	});

	const colors = $derived(COLOR_CLASSES[color]);
</script>

<div class="relative {className}" bind:this={containerEl} data-dropdown-open={open || undefined} data-input-select onfocusout={handleFocusOut}>
	<!-- Selected pills (multi-select only, shown above the input) -->
	{#if multiSelect && selectedItems.length > 0 && !hidePills}
		<div class="mb-1 flex flex-wrap gap-1">
			{#each selectedItems.slice(0, maxVisible) as item (item.value)}
				<button
					type="button"
					class="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium {colors.badge} {colors.badgeHover}"
					{disabled}
					onclick={() => removeItem(item.value)}
				>
					{getDisplayName(item)}
					<span class="ml-0.5 text-[10px]">×</span>
				</button>
			{/each}
			{#if selectedItems.length > maxVisible}
				<Badge
					variant="outline"
					class="px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
				>
					+{selectedItems.length - maxVisible}
				</Badge>
			{/if}
		</div>
	{/if}

	<!-- Search input -->
	<Input
		bind:value={searchQuery}
		bind:ref={inputEl}
		placeholder={inputPlaceholder}
		{disabled}
		autocomplete="off"
		autocapitalize="off"
		autocorrect="off"
		spellcheck={false}
		onfocus={() => (open = true)}
		onkeydown={handleKeydown}
		class="h-8 text-sm"
		data-focusable
	/>

	<!-- Single-select: show selected label as muted text inside/below input -->
	{#if !multiSelect && selectedItems.length > 0 && !open}
		<div class="pointer-events-none absolute inset-0 flex items-center px-3 text-sm">
			{getDisplayName(selectedItems[0])}
		</div>
	{/if}

	<!-- Dropdown -->
	{#if open}
		<div
			class="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
			bind:this={dropdownEl}
		>
			{#each filteredItems as item, idx (item.value)}
				{@const isSelected = selectedValues.includes(item.value)}
				{@const isHighlighted = idx === highlightedIndex}
				<button
					type="button"
					class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none {isHighlighted ? 'bg-accent/50' : ''}"
					data-item-index={idx}
					onmousedown={(e) => e.preventDefault()}
					onmouseenter={() => (highlightedIndex = idx)}
					onclick={() => {
						toggleItem(item.value);
						if (multiSelect) {
							searchQuery = '';
							inputEl?.focus();
						}
					}}
				>
					{#if multiSelect}
						<span class="flex size-3.5 shrink-0 items-center justify-center rounded-sm border {isSelected ? colors.checkbox + ' text-white' : 'border-input'}">
							{#if isSelected}
								<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
							{/if}
						</span>
					{:else}
						{#if isSelected}
							<span class="size-3.5 shrink-0 text-primary">&#10003;</span>
						{:else}
							<span class="size-3.5 shrink-0"></span>
						{/if}
					{/if}
					<span class={!multiSelect && isSelected ? 'font-medium' : ''}>
						{getDisplayName(item)}
					</span>
					{#if item.group}
						<span class="ml-auto text-xs text-muted-foreground">{item.group}</span>
					{/if}
				</button>
			{/each}

			{#if filteredItems.length === 0 && !canCreate}
				<p class="px-3 py-2 text-xs text-muted-foreground">No matches</p>
			{/if}

			{#if canCreate}
				{@const isCreateHighlighted = highlightedIndex === filteredItems.length}
				<button
					type="button"
					class="flex w-full items-center gap-2 border-t px-2 py-1.5 text-left text-sm text-green-700 dark:text-green-300 {isCreateHighlighted ? 'rounded-lg bg-accent/50' : ''}"
					data-item-index={filteredItems.length}
					{disabled}
					onmousedown={(e) => e.preventDefault()}
					onmouseenter={() => (highlightedIndex = filteredItems.length)}
					onclick={handleCreate}
				>
					{#if creating}
						<span class="text-xs text-muted-foreground">Creating...</span>
					{:else}
						+ Create "{normalizedCreateName}"
					{/if}
				</button>
			{/if}
		</div>
	{/if}
</div>
