<script lang="ts">
	import type { MetadataSummarySegment } from './table-row-metadata-summary-types';

	let {
		/** Segments rendered as a single truncated line below an editable row's heading. */
		segments,
		/** Optional extra classes appended to the wrapper. */
		class: className = ''
	}: {
		segments: MetadataSummarySegment[];
		class?: string;
	} = $props();
</script>

<div
	class={`-mt-1 truncate px-3 pb-3 text-xs text-muted-foreground md:px-4 ${className}`.trim()}
>
	{#each segments as segment, segmentIndex (segmentIndex)}
		{#if segment.italic}
			<span class="{segment.section ? 'ml-4' : ''} italic">{segment.text}</span>
		{:else}
			<span class="{segment.spaced ? 'ml-2' : ''} text-foreground">{segment.text}</span>
		{/if}
	{/each}
</div>
