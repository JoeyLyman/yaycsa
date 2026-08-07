import { getContext, setContext } from 'svelte';
import type { TableAudience } from './table-view-toggle-types';

/**
 * Shared audience context consumed by offer rows to decide which fields to
 * render. Mirrors the edit-mode context pattern: rows read a reactive accessor
 * rather than receiving audience as a prop drilled through every layer.
 */
export interface TableViewContext {
	/** Reactive accessor: returns the current audience lens for this table. */
	audience: () => TableAudience;
}

const TABLE_VIEW_CONTEXT_KEY = Symbol('table-view');

export function setTableViewContext(value: TableViewContext): TableViewContext {
	return setContext(TABLE_VIEW_CONTEXT_KEY, value);
}

export function getTableViewContext(): TableViewContext | null {
	return getContext<TableViewContext | null>(TABLE_VIEW_CONTEXT_KEY) ?? null;
}
