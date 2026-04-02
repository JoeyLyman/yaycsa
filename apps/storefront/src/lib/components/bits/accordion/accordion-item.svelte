<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn } from '$lib/components/utils';
	import type { AccordionItemProps } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: AccordionItemProps = $props();
</script>

<AccordionPrimitive.Item bind:ref class={cn('w-full', className)} {...restProps}>
	{@render children?.()}
</AccordionPrimitive.Item>
