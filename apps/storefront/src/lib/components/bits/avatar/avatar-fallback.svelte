<script lang="ts">
	import { Avatar as AvatarPrimitive } from "bits-ui";
	import { cn } from "$lib/components/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComponentProps<typeof AvatarPrimitive.Fallback> = $props();
</script>

<AvatarPrimitive.Fallback
	bind:ref
	class={cn(
		"bg-muted flex h-full w-full items-center justify-center rounded-full text-xs",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</AvatarPrimitive.Fallback>
