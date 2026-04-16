<script lang="ts">
	import { Input } from '$lib/components/bits/input';
	import { cn } from '$lib/components/utils.js';

	let {
		/** Reference to the underlying input element, bound when the row is in editing mode. */
		ref = $bindable(null),
		/** Current heading / input value. */
		value,
		/** Placeholder rendered inside the input and (greyed) inside the heading when value is empty. */
		placeholder = '',
		/** Optional inline error message rendered below the heading / input. */
		error = null,
		/** Whether to render the input (true) or the heading button (false). */
		editing = false,
		/** Whether the input should be disabled while editing (e.g. during a pending save). */
		disabled = false,
		/** Whether the heading button should be the table's tab target. */
		dataFocusable = false,
		/** Invoked when the heading button is clicked. Absent => heading click is a no-op (view mode). */
		onopenedit,
		/** Fires on every keystroke while editing. */
		oninput,
		/** Fires when the input loses focus. */
		onblur,
		/** Fires for each keydown while editing. */
		onkeydown,
		/** Optional extra classes applied to the outer wrapper. */
		class: className = ''
	}: {
		ref?: HTMLInputElement | null;
		value: string;
		placeholder?: string;
		error?: string | null;
		editing?: boolean;
		disabled?: boolean;
		dataFocusable?: boolean;
		onopenedit?: () => void;
		oninput?: (event: Event) => void;
		onblur?: (event: FocusEvent) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		class?: string;
	} = $props();
</script>

<div class={cn('space-y-1', className)}>
	{#if editing}
		<Input
			bind:ref
			{value}
			{placeholder}
			{disabled}
			class="h-8 px-2.5 text-[17px] font-medium leading-tight md:text-[17px]"
			aria-invalid={error ? 'true' : undefined}
			data-focusable={dataFocusable ? true : undefined}
			{oninput}
			{onblur}
			{onkeydown}
		/>
	{:else}
		<button
			type="button"
			class="-ml-1 inline-flex min-h-8 items-center truncate rounded px-1 py-0.5 text-left text-[17px] font-medium leading-tight outline-none {onopenedit ? 'cursor-text hover:underline focus-visible:underline' : ''}"
			data-focusable={dataFocusable ? true : undefined}
			data-auto-open={onopenedit ? true : undefined}
			onclick={onopenedit}
		>
			{#if value}
				{value}
			{:else}
				<span class="text-muted-foreground">{placeholder}</span>
			{/if}
		</button>
	{/if}

	{#if error}
		<p class="text-xs text-destructive">{error}</p>
	{/if}
</div>
