/**
 * Display helpers (labels and status colours) for the offer-list bundle.
 *
 * The view-model types and the Shop/Admin normalizers live in the data layer:
 * `#lib/api/offer-view-model.ts`.
 */

import type {
	OfferFulfillmentType,
	OfferPricingMode,
	OfferStatus
} from '#lib/api/offer-view-model.ts';

/** Human label for a fulfillment option's method. */
export function fulfillmentOptionTypeLabel(type: OfferFulfillmentType): string {
	if (type === 'scheduled_pickup') return 'Scheduled Pickup';
	if (type === 'scheduled_delivery') return 'Scheduled Delivery';
	return 'Shipping';
}

/** Human label for an offer's lifecycle status. */
export function offerStatusLabel(status: OfferStatus): string {
	if (status === 'active') return 'Active';
	if (status === 'draft') return 'Draft';
	if (status === 'paused') return 'Paused';
	return 'Expired';
}

/** Text colour classes for an offer status chip. */
export function offerStatusClasses(status: OfferStatus): string {
	if (status === 'active') return 'text-emerald-700';
	if (status === 'draft') return 'text-amber-700';
	if (status === 'paused') return 'text-slate-600';
	return 'text-muted-foreground';
}

/** Human label for a line item's pricing mode. */
export function pricingModeLabel(mode: OfferPricingMode): string {
	return mode === 'case' ? 'Case' : 'Tiered';
}
