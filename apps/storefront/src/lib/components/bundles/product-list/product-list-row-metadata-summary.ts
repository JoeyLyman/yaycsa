/**
 * A segment of the metadata summary — either a label (italic) or a value (normal).
 */
export interface SummarySegment {
	text: string;
	italic: boolean;
}

/**
 * Compute structured metadata summary segments for a collapsed product row.
 *
 * Returns an array of segments with italic flags so the template can style
 * labels ("Ingredients:", "Processed:", "Allergens:") differently from values.
 *
 * Examples:
 *   [{ text: "Raw", italic: false }, { text: " · ", italic: false }, { text: "fresh", italic: false }]
 *   [{ text: "Ingredients: ", italic: true }, { text: "Kale, Garlic +2", italic: false }, ...]
 */
export function computeMetadataSummary(
	bits: { label: string }[],
	processes: { label: string }[],
	allergens: { label: string }[]
): SummarySegment[] {
	const segments: SummarySegment[] = [];
	const sep: SummarySegment = { text: ' \u00A0·\u00A0 ', italic: false };

	// Bits / Ingredients
	if (bits.length === 0) {
		segments.push({ text: 'Raw', italic: false });
	} else {
		const names =
			bits.length <= 2
				? bits.map((b) => b.label).join(', ')
				: `${bits
						.slice(0, 2)
						.map((b) => b.label)
						.join(', ')} +${bits.length - 2}`;
		segments.push({ text: 'Ingredients: ', italic: true });
		segments.push({ text: names, italic: false });
	}

	// Processing
	segments.push(sep);
	if (processes.length === 0) {
		segments.push({ text: 'fresh', italic: false });
	} else {
		segments.push({ text: 'Processed: ', italic: true });
		segments.push({ text: processes.map((p) => p.label).join(', '), italic: false });
	}

	// Allergens (only shown if present)
	if (allergens.length > 0) {
		const names = allergens
			.map((a) => a.label.replace(/^May contain /i, ''))
			.join(', ');
		segments.push(sep);
		segments.push({ text: 'Allergens: ', italic: true });
		segments.push({ text: names, italic: false });
	}

	return segments;
}
