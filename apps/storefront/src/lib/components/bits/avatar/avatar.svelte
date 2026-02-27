<script lang="ts">
	import { Avatar as AvatarPrimitive } from "bits-ui";
	import { cn } from "$lib/components/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComponentProps<typeof AvatarPrimitive.Root> = $props();
</script>

<AvatarPrimitive.Root
	bind:ref
	class={cn(
		"relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</AvatarPrimitive.Root>
