/**
 * Global metadata visibility modes for the seller product table.
 *
 * - `hidden`   — hide both the metadata summary line and the expanded metadata block
 * - `summary`  — show only the collapsed summary line by default
 * - `expanded` — show the full metadata editor block by default
 */
export type ProductMetadataMode = 'hidden' | 'summary' | 'expanded';

/**
 * Unsaved inline product draft rendered at the bottom of the seller product list.
 * Each draft row owns its own temporary UI identity so multiple drafts can be
 * created, edited, saved, and canceled independently.
 */
export interface ProductDraft {
	id: string;
	name: string;
	bitIds: string[];
	processIds: string[];
	allergenIds: string[];
}

/**
 * Partial updates applied to a single draft row as the seller types.
 * Only the changed field is sent upward so the page can keep parent-owned
 * draft state simple and predictable.
 */
export interface ProductDraftPatch {
	name?: string;
	bitIds?: string[];
	processIds?: string[];
	allergenIds?: string[];
}
