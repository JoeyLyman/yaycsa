<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';
	import { nextTableDetailMode, type TableDetailMode } from './table-detail-toggle-types';

	let {
		/** Current detail visibility mode. Bindable so the parent owns the state. */
		mode = $bindable(),
		/** Optional change notification fired after the mode flips. */
		onchange
	}: {
		mode: TableDetailMode;
		onchange?: (next: TableDetailMode) => void;
	} = $props();

	/** Shared edit-mode context — when present, the toggle disables itself in edit mode. */
	const tableEditModeContext = getTableEditModeContext();

	/** Whether the parent table is currently in edit mode. False if no context provider is mounted. */
	let editMode = $derived(tableEditModeContext ? tableEditModeContext.editMode() : false);

	function handleClick() {
		const next = nextTableDetailMode(mode);
		mode = next;
		onchange?.(next);
	}
</script>

<Button
	size="sm"
	variant="ghost"
	class="h-7 gap-1 px-2 text-xs text-muted-foreground"
	disabled={editMode}
	title={mode === 'summary' ? 'Expand detail' : 'Collapse detail'}
	onclick={handleClick}
	data-testid="table-detail-toggle"
>
	<span>Detail</span>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="translate-y-px"
		aria-hidden="true"
	>
		{#if mode === 'summary'}
			<polyline points="6 9 12 15 18 9" />
		{:else}
			<polyline points="6 15 12 9 18 15" />
		{/if}
	</svg>
</Button>
