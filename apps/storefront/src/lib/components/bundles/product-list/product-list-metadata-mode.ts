import type { ProductMetadataMode } from './product-list-types';

/**
 * Toggle between the two metadata display modes.
 */
export function nextProductMetadataMode(currentMode: ProductMetadataMode): ProductMetadataMode {
	return currentMode === 'summary' ? 'expanded' : 'summary';
}
