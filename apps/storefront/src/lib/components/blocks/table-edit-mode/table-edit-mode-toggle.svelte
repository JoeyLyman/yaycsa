<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import * as AlertDialog from '$lib/components/bits/alert-dialog';

	let {
		/** Whether the table is currently in edit mode. */
		editMode,
		/** Whether any row has unsaved edits or an open draft. Drives the confirm-dialog on exit. */
		hasUnsavedChanges,
		/** Emit when the caller should transition to the given edit-mode state. */
		onchange
	}: {
		editMode: boolean;
		hasUnsavedChanges: boolean;
		onchange: (next: boolean) => void;
	} = $props();

	/** Whether the "Discard unsaved changes?" confirm dialog is currently open. */
	let confirmOpen = $state(false);

	function handleToggleClick() {
		if (!editMode) {
			onchange(true);
			return;
		}
		if (hasUnsavedChanges) {
			confirmOpen = true;
			return;
		}
		onchange(false);
	}

	function handleDiscard() {
		confirmOpen = false;
		onchange(false);
	}
</script>

<Button
	size="sm"
	variant={editMode ? 'default' : 'outline'}
	onclick={handleToggleClick}
	data-testid="table-edit-mode-toggle"
>
	{editMode ? 'Stop Editing' : 'Edit'}
</Button>

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Discard unsaved changes?</AlertDialog.Title>
			<AlertDialog.Description>
				You have unsaved edits. Leaving edit mode will discard them and any in-progress draft rows.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleDiscard}>Discard changes</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
