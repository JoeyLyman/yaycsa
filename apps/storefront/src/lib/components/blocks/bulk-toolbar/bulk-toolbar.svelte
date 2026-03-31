<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import type { Snippet } from 'svelte';

	let {
		/** Number of items currently selected. */
		selectedCount,
		/** Whether the toolbar is visible (slides up when true). */
		visible = false,
		/** Callback to clear all selections. */
		onclear,
		/** Slot for entity-specific action buttons. */
		actions,
	}: {
		selectedCount: number;
		visible?: boolean;
		onclear: () => void;
		actions: Snippet;
	} = $props();
</script>

{#if visible}
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm transition-transform duration-200"
		class:translate-y-0={visible}
	>
		<div class="mx-auto flex max-w-5xl items-center gap-3">
			<!-- Selected count -->
			<span class="text-sm font-medium">
				{selectedCount} selected
			</span>

			<!-- Entity-specific actions (slot) -->
			<div class="flex items-center gap-2">
				{@render actions()}
			</div>

			<!-- Clear selection -->
			<Button size="sm" variant="ghost" onclick={onclear} class="ml-auto">
				Clear
			</Button>
		</div>
	</div>
{/if}
