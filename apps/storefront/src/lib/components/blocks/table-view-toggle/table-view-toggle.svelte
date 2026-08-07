<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import { getTableEditModeContext } from '$lib/components/blocks/table-edit-mode';
	import { nextTableAudience, type TableAudience } from './table-view-toggle-types';

	let {
		/** Current audience lens. Bindable so the parent owns the state. */
		audience = $bindable(),
		/** Optional change notification fired after the audience flips. */
		onchange
	}: {
		audience: TableAudience;
		onchange?: (next: TableAudience) => void;
	} = $props();

	/** Shared edit-mode context — when present, editing locks the audience to admin. */
	const tableEditModeContext = getTableEditModeContext();

	/** Whether the parent table is currently in edit mode. False if no context provider is mounted. */
	let editMode = $derived(tableEditModeContext ? tableEditModeContext.editMode() : false);

	/** Whether the seller is currently previewing the buyer-facing lens. */
	let showingCustomerView = $derived(audience === 'customer');

	function handleClick() {
		const next = nextTableAudience(audience);
		audience = next;
		onchange?.(next);
	}
</script>

<Button
	size="sm"
	variant={showingCustomerView ? 'default' : 'ghost'}
	class="h-7 gap-1 px-2 text-xs {showingCustomerView ? '' : 'text-muted-foreground'}"
	disabled={editMode}
	title={showingCustomerView
		? 'Previewing the buyer-facing view — switch back to admin'
		: 'Preview what buyers see on your page'}
	onclick={handleClick}
	data-testid="table-view-toggle"
>
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
		aria-hidden="true"
	>
		<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
	<span>{showingCustomerView ? 'Customer view' : 'Admin view'}</span>
</Button>
