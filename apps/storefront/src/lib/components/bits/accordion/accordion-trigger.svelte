<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn } from '$lib/components/utils';
	import type { AccordionTriggerProps } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: AccordionTriggerProps = $props();
</script>

<AccordionPrimitive.Trigger
	bind:ref
	class={cn(
		'flex w-full items-center justify-start gap-2 rounded-md text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</AccordionPrimitive.Trigger>
