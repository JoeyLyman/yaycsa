<script lang="ts">
	import Sun from '@lucide/svelte/icons/sun';
	import { cn } from '$lib/components/utils.js';
	import type { ComponentProps } from 'svelte';

	let { class: className, ...restProps }: ComponentProps<typeof Sun> = $props();
</script>

<Sun class={cn('size-4 animate-spin [animation-duration:2.7s]', className)} {...restProps} />
