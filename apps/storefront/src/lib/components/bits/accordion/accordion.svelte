<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn } from '$lib/components/utils';
	import type { AccordionRootProps } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: AccordionRootProps = $props();
</script>

<AccordionPrimitive.Root bind:ref class={cn('w-full', className)} {...restProps}>
	{@render children?.()}
</AccordionPrimitive.Root>
