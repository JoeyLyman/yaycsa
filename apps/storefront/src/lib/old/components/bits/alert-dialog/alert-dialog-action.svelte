<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { buttonVariants } from '#lib/old/components/bits/button/index.js';
	import { cn } from '#lib/old/components/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: AlertDialogPrimitive.ActionProps = $props();
</script>

<AlertDialogPrimitive.Action
	bind:ref
	data-slot="alert-dialog-action"
	class={cn(buttonVariants(), className)}
	{...restProps}
/>
