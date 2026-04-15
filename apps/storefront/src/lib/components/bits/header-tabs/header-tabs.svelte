<script lang="ts">
	import { cn } from '$lib/components/utils.js';

	type HeaderTabValue = string;

	interface HeaderTabItem {
		value: HeaderTabValue;
		label: string;
		href?: string;
		disabled?: boolean;
	}

	let {
		/** Tabs rendered in the header control. */
		items,
		/** The currently selected tab value. */
		selectedValue,
		/** Optional callback that handles tab selection without relying on full-page navigation. */
		onselect,
		/** Accessible label announced for the whole tab group. */
		ariaLabel = 'Header tabs',
		/** Visual size variant. Use xl for page headers and lg for tighter brand-like contexts. */
		size = 'xl',
		/** Optional extra wrapper classes from the parent. */
		class: className
	}: {
		items: HeaderTabItem[];
		selectedValue: HeaderTabValue;
		onselect?: (value: HeaderTabValue) => void;
		ariaLabel?: string;
		size?: 'lg' | 'xl';
		class?: string;
	} = $props();

	function isSelected(value: HeaderTabValue): boolean {
		return value === selectedValue;
	}

	function getTextSizeClasses(): string {
		return size === 'lg' ? 'text-lg font-bold' : 'text-2xl font-bold';
	}

	function getItemClasses(item: HeaderTabItem): string {
		if (item.disabled) {
			return cn(getTextSizeClasses(), 'cursor-not-allowed text-muted-foreground/40');
		}

		if (isSelected(item.value)) {
			return cn(getTextSizeClasses(), 'cursor-default text-foreground');
		}

		return cn(
			getTextSizeClasses(),
			'text-muted-foreground/60 transition-colors hover:text-muted-foreground'
		);
	}

	function getDotClasses(): string {
		return cn(getTextSizeClasses(), 'mx-2 text-foreground');
	}

	function handleAnchorClick(event: MouseEvent, item: HeaderTabItem) {
		if (item.disabled) {
			event.preventDefault();
			return;
		}

		if (onselect) {
			event.preventDefault();
			if (!isSelected(item.value)) {
				onselect(item.value);
			}
		}
	}

	function handleButtonClick(item: HeaderTabItem) {
		if (item.disabled || isSelected(item.value)) return;
		onselect?.(item.value);
	}
</script>

<nav aria-label={ariaLabel} class={cn('flex min-w-0 flex-wrap items-center', className)}>
	{#each items as item, index (item.value)}
		{#if item.href}
			<a
				href={item.href}
				aria-current={isSelected(item.value) ? 'page' : undefined}
				class={getItemClasses(item)}
				onclick={(event) => handleAnchorClick(event, item)}
			>
				{item.label}
			</a>
		{:else}
			<button
				type="button"
				class={cn('border-0 bg-transparent p-0 text-left', getItemClasses(item))}
				aria-pressed={isSelected(item.value)}
				disabled={item.disabled}
				onclick={() => handleButtonClick(item)}
			>
				{item.label}
			</button>
		{/if}

		{#if index < items.length - 1}
			<span aria-hidden="true" class={getDotClasses()}>&middot;</span>
		{/if}
	{/each}
</nav>
