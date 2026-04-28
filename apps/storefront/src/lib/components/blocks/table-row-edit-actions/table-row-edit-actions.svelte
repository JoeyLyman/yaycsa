<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';

	let {
		/** Whether the save mutation is currently in flight. Disables both buttons and replaces the Save label with a spinner. */
		saving = false,
		/** Whether the underlying form is valid enough to allow a save. Save is also disabled while `saving`. */
		canSave = true,
		/** Optional override for the Save button label, e.g. "Save New Product" on draft rows. */
		saveLabel = 'Save',
		/** Click handler for the Save button. */
		onsave,
		/** Click handler for the Cancel button. */
		oncancel
	}: {
		saving?: boolean;
		canSave?: boolean;
		saveLabel?: string;
		onsave: () => void;
		oncancel: () => void;
	} = $props();
</script>

<div class="flex items-center gap-1">
	<Button size="sm" disabled={!canSave || saving} data-focusable onclick={onsave}>
		{#if saving}
			<SpinnerSun class="size-3.5" />
		{:else}
			{saveLabel}
		{/if}
	</Button>
	<Button
		size="sm"
		variant="ghost"
		class="-mr-2"
		disabled={saving}
		data-focusable
		onclick={oncancel}
	>
		Cancel
	</Button>
</div>
