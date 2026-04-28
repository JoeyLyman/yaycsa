<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/bits/button';

	let {
		/** Whether the action menu is currently open. Bindable so parents can also drive it via callbacks. */
		open = $bindable(false),
		/** Whether the row is currently mid-mutation. Disables Cancel + dims the open ellipsis. */
		disabled = false,
		/** Tooltip on the closed ellipsis button. Defaults to "More actions". */
		title = 'More actions',
		/** Fires whenever `open` flips. Useful for parents that want to mirror state externally. */
		onchange,
		/** Action buttons rendered when the menu is open, to the left of the Cancel button. */
		children
	}: {
		open?: boolean;
		disabled?: boolean;
		title?: string;
		onchange?: (next: boolean) => void;
		children: Snippet;
	} = $props();

	function setOpen(next: boolean) {
		if (open === next) return;
		open = next;
		onchange?.(next);
	}
</script>

{#if open}
	<div class="flex items-center gap-1">
		{@render children()}
		<Button
			size="sm"
			variant="ghost"
			data-focusable
			{disabled}
			onclick={() => setOpen(false)}
		>
			Cancel
		</Button>
	</div>
{:else}
	<button
		class="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
		data-focusable
		{disabled}
		{title}
		onclick={() => setOpen(true)}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="5" r="1" />
			<circle cx="12" cy="12" r="1" />
			<circle cx="12" cy="19" r="1" />
		</svg>
	</button>
{/if}
