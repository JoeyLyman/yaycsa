import type { ProductMetadataMode } from './product-list-types';

/**
 * Return the next metadata mode in the shared three-state cycle.
 *
 * Cycle order:
 * - summary  → expanded
 * - expanded → hidden
 * - hidden   → summary
 */
export function nextProductMetadataMode(currentMode: ProductMetadataMode): ProductMetadataMode {
	if (currentMode === 'summary') return 'expanded';
	if (currentMode === 'expanded') return 'hidden';
	return 'summary';
}
