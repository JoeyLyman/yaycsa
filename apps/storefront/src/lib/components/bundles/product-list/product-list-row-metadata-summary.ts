import {
	metadataLabel,
	metadataValue,
	type MetadataSummarySegment
} from '$lib/components/blocks/table-row-metadata-summary';

/** Capitalize the first letter of each word. */
function titleCase(s: string): string {
	return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeMetadataSummary(
	bits: { label: string }[],
	processes: { label: string }[],
	allergens: { label: string }[]
): MetadataSummarySegment[] {
	const segments: MetadataSummarySegment[] = [];

	// Ingredients
	segments.push(metadataLabel('Ingredients'));
	if (bits.length === 0) {
		segments.push(metadataValue('–'));
	} else {
		const names =
			bits.length <= 2
				? bits.map((b) => titleCase(b.label)).join(', ')
				: `${bits
						.slice(0, 2)
						.map((b) => titleCase(b.label))
						.join(', ')} +${bits.length - 2}`;
		segments.push(metadataValue(names));
	}

	// Processing
	segments.push(metadataLabel('Processing', { section: true }));
	if (processes.length === 0) {
		segments.push(metadataValue('–'));
	} else {
		segments.push(metadataValue(processes.map((p) => titleCase(p.label)).join(', ')));
	}

	// Allergens (only shown if present)
	if (allergens.length > 0) {
		const names = allergens
			.map((a) => titleCase(a.label.replace(/^May contain /i, '')))
			.join(', ');
		segments.push(metadataLabel('Allergens', { section: true }));
		segments.push(metadataValue(names));
	}

	return segments;
}
