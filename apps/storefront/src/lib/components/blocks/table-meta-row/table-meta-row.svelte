<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		/** Italic/muted label on the left of the summary line (e.g. "Fulfillment", "Notes"). */
		label,
		/** Plain-text summary rendered next to the label when the editor is closed. */
		summary,
		/** Whether the inline editor region is currently open. */
		open = false,
		/** Whether the summary row should render as a non-interactive read-only line. */
		disabled = false,
		/** Click handler for the summary row. Omit (or pair with `disabled`) to render the summary as plain text. */
		ontoggle,
		/** Inline editor content rendered below the summary while the row is open. */
		editor
	}: {
		label: string;
		summary: string;
		open?: boolean;
		disabled?: boolean;
		ontoggle?: () => void;
		editor?: Snippet;
	} = $props();

	/**
	 * Whether the summary row should render as a clickable affordance.
	 * Both an `ontoggle` handler AND `!disabled` are required.
	 */
	let interactive = $derived(!disabled && Boolean(ontoggle));

	function handleSummaryClick(event: MouseEvent) {
		if (!interactive) return;
		event.stopPropagation();
		ontoggle?.();
	}
</script>

<div class="overflow-visible">
	{#if interactive}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="inline-flex w-fit cursor-pointer items-baseline py-1"
			onclick={handleSummaryClick}
			data-focusable
		>
			<span class="italic text-muted-foreground">{label}</span>
			<span class="ml-2">{summary}</span>
		</div>
	{:else}
		<div class="inline-flex items-baseline py-1">
			<span class="italic text-muted-foreground">{label}</span>
			<span class="ml-2">{summary}</span>
		</div>
	{/if}

	{#if open && editor}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="pb-1" onclick={(event) => event.stopPropagation()}>
			{@render editor()}
		</div>
	{/if}
</div>
