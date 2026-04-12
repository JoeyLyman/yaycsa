/**
 * Normalize a product name for case-insensitive duplicate checks.
 *
 * We intentionally keep this normalization conservative:
 * - trim outer whitespace
 * - lowercase
 *
 * We do not collapse internal whitespace or rewrite punctuation because the UI
 * should compare what sellers actually typed, just without case/edge-space noise.
 */
export function normalizeProductName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * Check whether a candidate product name collides with any taken names.
 * Empty names never count as duplicates because the caller should handle
 * required/min-length validation separately.
 */
export function hasDuplicateProductName(candidateName: string, takenNames: string[]): boolean {
	const normalizedCandidateName = normalizeProductName(candidateName);
	if (!normalizedCandidateName) return false;

	return takenNames.some(
		(takenName) => normalizeProductName(takenName) === normalizedCandidateName,
	);
}
