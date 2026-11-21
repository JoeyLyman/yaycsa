<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn } from '#lib/old/components/utils.ts';
	import type { AccordionContentProps } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: AccordionContentProps = $props();
</script>

<AccordionPrimitive.Content bind:ref class={cn('overflow-hidden', className)} {...restProps}>
	{@render children?.()}
</AccordionPrimitive.Content>
