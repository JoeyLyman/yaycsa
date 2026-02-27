<script lang="ts">
	import { Avatar as AvatarPrimitive } from "bits-ui";
	import { cn } from "$lib/components/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof AvatarPrimitive.Image> = $props();
</script>

<AvatarPrimitive.Image
	bind:ref
	class={cn("aspect-square h-full w-full", className)}
	{...restProps}
/>
