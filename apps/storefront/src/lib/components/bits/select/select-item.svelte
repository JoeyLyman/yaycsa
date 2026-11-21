<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '$lib/components/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children: itemChildren,
		...restProps
	}: SelectPrimitive.ItemProps = $props();
</script>

<SelectPrimitive.Item
	bind:ref
	class={cn(
		'relative flex w-full cursor-default items-center gap-2 rounded-sm px-3 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
		className
	)}
	{...restProps}
>
	{#snippet children({ selected, highlighted })}
		{#if selected}
			<span class="size-3.5 shrink-0 text-primary">&#10003;</span>
		{:else}
			<span class="size-3.5 shrink-0"></span>
		{/if}
		<span>{@render itemChildren?.({ selected, highlighted })}</span>
	{/snippet}
</SelectPrimitive.Item>
