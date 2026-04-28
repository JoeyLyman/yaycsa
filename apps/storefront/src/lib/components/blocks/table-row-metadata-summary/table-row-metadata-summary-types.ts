/**
 * One segment of a one-line metadata summary rendered below an editable table row.
 *
 * Use the helpers below to build segment lists from feature-specific data; the
 * `<TableRowMetadataSummary>` component renders any list of segments uniformly.
 */
export interface MetadataSummarySegment {
	/** Visible text for this segment. */
	text: string;
	/** Render italic muted (used for labels like "Ingredients", "Pickup Window"). */
	italic: boolean;
	/** Add `ml-2` left margin (used for a value that follows its own label). */
	spaced: boolean;
	/** Add `ml-4` left margin (used for the first segment of a new section). */
	section: boolean;
}

/** Builder for the italic muted label segment that opens a section. */
export function metadataLabel(text: string, options: { section?: boolean } = {}): MetadataSummarySegment {
	return { text, italic: true, spaced: false, section: options.section ?? false };
}

/** Builder for the foreground value segment that follows a label. */
export function metadataValue(text: string): MetadataSummarySegment {
	return { text, italic: false, spaced: true, section: false };
}
