<script lang="ts">
	import { Input } from '$lib/components/bits/input';
	import { cn } from '$lib/components/utils.js';

	let {
		/** Reference to the underlying input element for autofocus from parent rows. */
		ref = $bindable(null),
		/** Current product name value shown in the input. */
		value,
		/** Optional inline validation message shown below the input. */
		error = null,
		/** Placeholder text for empty draft rows. */
		placeholder = '',
		/** Whether the wrapped input should be disabled. */
		disabled = false,
		/** Whether the underlying input should participate in table keyboard navigation. */
		dataFocusable = false,
		/** Optional input callback forwarded to the underlying input. */
		oninput,
		/** Optional blur callback forwarded to the underlying input. */
		onblur,
		/** Optional keydown callback forwarded to the underlying input. */
		onkeydown,
		/** Optional extra classes for the wrapped input. */
		class: className = ''
	}: {
		ref?: HTMLInputElement | null;
		value: string;
		error?: string | null;
		placeholder?: string;
		disabled?: boolean;
		dataFocusable?: boolean;
		oninput?: (event: Event) => void;
		onblur?: (event: FocusEvent) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		class?: string;
	} = $props();
</script>

<div class="space-y-1">
	<Input
		bind:ref
		{value}
		{placeholder}
		{disabled}
		class={cn('h-8 px-2.5 text-[17px] font-medium leading-tight md:text-[17px]', className)}
		aria-invalid={error ? 'true' : undefined}
		data-focusable={dataFocusable ? true : undefined}
		{oninput}
		{onblur}
		{onkeydown}
	/>

	{#if error}
		<p class="text-xs text-destructive">{error}</p>
	{/if}
</div>
