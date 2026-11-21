import { getContext, setContext } from 'svelte';

/** Shape of the shared edit-mode context consumed by table rows and row-metadata. */
export interface TableEditModeContext {
	/** Reactive accessor: returns the current edit-mode flag for this table. */
	editMode: () => boolean;
	/** Register or update a row's dirty flag. Called from row `$effect`s. */
	registerDirty: (id: string, isDirty: boolean) => void;
	/** Remove a row from the dirty registry on unmount. */
	unregisterDirty: (id: string) => void;
}

const TABLE_EDIT_MODE_CONTEXT_KEY = Symbol('table-edit-mode');

export function setTableEditModeContext(value: TableEditModeContext): TableEditModeContext {
	return setContext(TABLE_EDIT_MODE_CONTEXT_KEY, value);
}

export function getTableEditModeContext(): TableEditModeContext | null {
	return getContext<TableEditModeContext | null>(TABLE_EDIT_MODE_CONTEXT_KEY) ?? null;
}
