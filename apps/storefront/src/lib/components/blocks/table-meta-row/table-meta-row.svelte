<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		/** Italic/muted label on the left of the summary line (e.g. "Fulfillment", "Notes"). */
		label,
		/** Plain-text summary rendered next to the label when the editor is closed. */
		summary,
		/** Whether the inline editor region is currently open. */
		open = false,
		/** Whether the summary row should render as click-to-open. Disabled rows still render the summary. */
		disabled = false,
		/** Click handler for the summary row. Fires only when `disabled` is false. */
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

	function handleSummaryClick(event: MouseEvent) {
		if (disabled || !ontoggle) return;
		event.stopPropagation();
		ontoggle();
	}
</script>

<div class="overflow-visible">
	{#if disabled}
		<div class="inline-flex items-baseline py-1">
			<span class="italic text-muted-foreground">{label}</span>
			<span class="ml-2">{summary}</span>
		</div>
	{:else}
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
	{/if}

	{#if open && editor}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="pb-1" onclick={(event) => event.stopPropagation()}>
			{@render editor()}
		</div>
	{/if}
</div>
