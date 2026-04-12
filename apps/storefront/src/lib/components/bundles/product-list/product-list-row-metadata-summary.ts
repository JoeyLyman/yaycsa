/**
 * A segment of the metadata summary.
 */
export interface SummarySegment {
	text: string;
	italic: boolean;
	/** Whether this segment should have left margin (value following a label). */
	spaced: boolean;
	/** Whether this segment starts a new section (larger left margin). */
	section: boolean;
}

/** Capitalize the first letter of each word. */
function titleCase(s: string): string {
	return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeMetadataSummary(
	bits: { label: string }[],
	processes: { label: string }[],
	allergens: { label: string }[]
): SummarySegment[] {
	const segments: SummarySegment[] = [];

	// Ingredients
	segments.push({ text: 'Ingredients', italic: true, spaced: false, section: false });
	if (bits.length === 0) {
		segments.push({ text: '–', italic: false, spaced: true, section: false });
	} else {
		const names =
			bits.length <= 2
				? bits.map((b) => titleCase(b.label)).join(', ')
				: `${bits
						.slice(0, 2)
						.map((b) => titleCase(b.label))
						.join(', ')} +${bits.length - 2}`;
		segments.push({ text: names, italic: false, spaced: true, section: false });
	}

	// Processing
	segments.push({ text: 'Processing', italic: true, spaced: false, section: true });
	if (processes.length === 0) {
		segments.push({ text: '–', italic: false, spaced: true, section: false });
	} else {
		segments.push({ text: processes.map((p) => titleCase(p.label)).join(', '), italic: false, spaced: true, section: false });
	}

	// Allergens (only shown if present)
	if (allergens.length > 0) {
		const names = allergens
			.map((a) => titleCase(a.label.replace(/^May contain /i, '')))
			.join(', ');
		segments.push({ text: 'Allergens', italic: true, spaced: false, section: true });
		segments.push({ text: names, italic: false, spaced: true, section: false });
	}

	return segments;
}
