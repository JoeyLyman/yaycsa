/**
 * Types for the shared table status filter — a compact multi-select dropdown
 * used in table headers to narrow rows by status (e.g. active / inactive /
 * deleted). Each table supplies its own option list, so the same control can
 * drive different domains (offers, fulfillment options, future tables).
 */

/** A single selectable status option rendered as a checkbox row in the dropdown. */
export interface TableStatusFilterOption {
	/** Stable machine value used as the selection key (e.g. 'active'). */
	value: string;
	/** Human-readable label shown in the dropdown (e.g. 'Active'). */
	label: string;
	/**
	 * Optional count badge shown to the right of the label.
	 * Omit when a count is not meaningful for the option.
	 */
	count?: number;
}
