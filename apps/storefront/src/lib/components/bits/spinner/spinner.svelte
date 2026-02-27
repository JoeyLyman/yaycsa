<script lang="ts">
	import { cn } from "$lib/components/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let { class: className, ...restProps }: HTMLAttributes<SVGElement> = $props();
</script>

<svg
	role="status"
	aria-label="Loading"
	class={cn("size-4 animate-spin", className)}
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	{...restProps}
>
	<path d="M21 12a9 9 0 1 1-6.219-8.56" />
</svg>
