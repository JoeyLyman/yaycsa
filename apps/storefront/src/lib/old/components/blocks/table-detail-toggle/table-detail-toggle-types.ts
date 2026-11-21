/**
 * Two-state metadata visibility for editable tables.
 *
 * - `summary`  — show a one-line summary of metadata fields below the row heading.
 * - `expanded` — show the full metadata editor block below the row heading.
 */
export type TableDetailMode = 'summary' | 'expanded';

/** Toggle between the two metadata display modes. */
export function nextTableDetailMode(currentMode: TableDetailMode): TableDetailMode {
	return currentMode === 'summary' ? 'expanded' : 'summary';
}
