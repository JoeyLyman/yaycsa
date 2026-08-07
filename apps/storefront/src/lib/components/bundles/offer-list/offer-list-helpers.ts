/**
 * Adapters from the two raw offer payloads (Shop API `activeOffers` and the
 * Admin proxy offers query) into the shared {@link OfferListItem} view-model.
 *
 * Both normalizers produce an identical buyer-facing subset for the same offer;
 * the admin normalizer additionally fills the admin-only fields. The offer
 * parity test (`tests/offer-parity.spec.ts`) leans on {@link buyerFacingOfferView}
 * to assert that guarantee against real data from both APIs.
 *
 * This module is intentionally free of `$app` / `$lib` imports so it can be used
 * from remote functions (server) AND imported directly by the Playwright test
 * runner (node) without pulling in SvelteKit server internals.
 */

import type {
	OfferFulfillmentOptionView,
	OfferFulfillmentType,
	OfferListItem,
	OfferLineItemView,
	OfferPricingMode,
	OfferQuantityLimitMode,
	OfferStatus,
	OfferWeekday
} from './offer-list-types';

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

/** Raw fulfillment option as returned by either API (buyer-facing fields only). */
export interface RawOfferFulfillmentOption {
	id: string;
	name: string;
	type: OfferFulfillmentType;
	notes: string | null;
	fulfillmentWeekday: OfferWeekday | null;
	fulfillmentTimeWindowStart: number | null;
	fulfillmentTimeWindowEnd: number | null;
	orderDeadlineWeekday: OfferWeekday | null;
	orderDeadlineTime: number | null;
}

/** Raw offer line item. Admin-only fields are present in the admin payload. */
export interface RawOfferLineItem {
	id: string;
	productVariant: {
		id: string;
		name: string;
		sku: string;
		customFields?: { unitType?: string | null } | null;
	};
	price: number;
	priceIncludesTax: boolean;
	pricingMode: OfferPricingMode;
	priceTiers: unknown;
	quantityRemaining: number | null;
	notes: string | null;
	sortOrder: number;
	// Admin-only — undefined when sourced from the customer lens.
	quantityLimitMode?: OfferQuantityLimitMode;
	quantityLimit?: number | null;
	quantityOrdered?: number | null;
	autoConfirm?: boolean;
}

/** Raw offer as returned by either API. Admin-only fields present only in the admin payload. */
export interface RawOffer {
	id: string;
	seller: { id: string; name: string };
	validFrom: string;
	validUntil: string | null;
	allowLateOrders: boolean;
	notes: string | null;
	fulfillmentOptions: RawOfferFulfillmentOption[];
	lineItems: RawOfferLineItem[];
	// Admin-only.
	status?: OfferStatus;
	internalNotes?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

/** Stable id comparator used to give both sources a deterministic order. */
function byId(a: { id: string }, b: { id: string }): number {
	return a.id.localeCompare(b.id);
}

/** Line-item display order: by `sortOrder`, then id as a stable tiebreak. */
function bySortOrderThenId(a: OfferLineItemView, b: OfferLineItemView): number {
	return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

/** Map a raw fulfillment option to its view shape (all fields buyer-facing). */
function normalizeFulfillmentOption(raw: RawOfferFulfillmentOption): OfferFulfillmentOptionView {
	return {
		id: raw.id,
		name: raw.name,
		type: raw.type,
		notes: raw.notes,
		fulfillmentWeekday: raw.fulfillmentWeekday,
		fulfillmentTimeWindowStart: raw.fulfillmentTimeWindowStart,
		fulfillmentTimeWindowEnd: raw.fulfillmentTimeWindowEnd,
		orderDeadlineWeekday: raw.orderDeadlineWeekday,
		orderDeadlineTime: raw.orderDeadlineTime
	};
}

/**
 * Map a raw line item to its view shape. When `includeAdminFields` is false the
 * admin-only fields are omitted, producing the customer lens.
 */
function normalizeLineItem(raw: RawOfferLineItem, includeAdminFields: boolean): OfferLineItemView {
	const base: OfferLineItemView = {
		id: raw.id,
		productVariantId: raw.productVariant.id,
		productVariantName: raw.productVariant.name,
		productVariantSku: raw.productVariant.sku,
		unitType: raw.productVariant.customFields?.unitType ?? null,
		price: raw.price,
		priceIncludesTax: raw.priceIncludesTax,
		pricingMode: raw.pricingMode,
		priceTiers: raw.priceTiers,
		quantityRemaining: raw.quantityRemaining,
		notes: raw.notes,
		sortOrder: raw.sortOrder
	};
	if (!includeAdminFields) return base;
	return {
		...base,
		quantityLimitMode: raw.quantityLimitMode,
		quantityLimit: raw.quantityLimit ?? null,
		quantityOrdered: raw.quantityOrdered ?? null,
		autoConfirm: raw.autoConfirm
	};
}

/**
 * Core adapter. `includeAdminFields` selects the lens:
 * - false → customer subset (shop-sourced data / Customer view).
 * - true  → full admin superset.
 *
 * Fulfillment options are ordered by id (the shop payload carries no sortOrder),
 * and line items by their `sortOrder`, so both sources yield a deterministic,
 * comparable shape.
 */
function normalizeOffer(raw: RawOffer, includeAdminFields: boolean): OfferListItem {
	const fulfillmentOptions = raw.fulfillmentOptions.map(normalizeFulfillmentOption).sort(byId);
	const lineItems = raw.lineItems
		.map((lineItem) => normalizeLineItem(lineItem, includeAdminFields))
		.sort(bySortOrderThenId);

	const base: OfferListItem = {
		id: raw.id,
		sellerId: raw.seller.id,
		sellerName: raw.seller.name,
		validFrom: raw.validFrom,
		validUntil: raw.validUntil,
		allowLateOrders: raw.allowLateOrders,
		notes: raw.notes,
		fulfillmentOptions,
		lineItems
	};
	if (!includeAdminFields) return base;
	return {
		...base,
		status: raw.status,
		internalNotes: raw.internalNotes ?? null,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt
	};
}

/** Adapt a Shop API `activeOffers` item into the customer-lens view-model. */
export function normalizeShopOffer(raw: RawOffer): OfferListItem {
	return normalizeOffer(raw, false);
}

/** Adapt an Admin proxy offer into the full admin-lens view-model. */
export function normalizeAdminOffer(raw: RawOffer): OfferListItem {
	return normalizeOffer(raw, true);
}

/**
 * Extract only the buyer-facing subset of a normalized offer, sorted
 * deterministically. Both a shop-normalized and an admin-normalized offer for
 * the same underlying record must produce a deeply-equal result — that equality
 * is what the parity test asserts and what guarantees Customer view matches the
 * public page.
 */
export function buyerFacingOfferView(offer: OfferListItem) {
	return {
		id: offer.id,
		sellerId: offer.sellerId,
		sellerName: offer.sellerName,
		validFrom: offer.validFrom,
		validUntil: offer.validUntil,
		allowLateOrders: offer.allowLateOrders,
		notes: offer.notes,
		fulfillmentOptions: [...offer.fulfillmentOptions].sort(byId),
		lineItems: offer.lineItems
			.map((lineItem) => ({
				id: lineItem.id,
				productVariantId: lineItem.productVariantId,
				productVariantName: lineItem.productVariantName,
				productVariantSku: lineItem.productVariantSku,
				unitType: lineItem.unitType,
				price: lineItem.price,
				priceIncludesTax: lineItem.priceIncludesTax,
				pricingMode: lineItem.pricingMode,
				priceTiers: lineItem.priceTiers,
				quantityRemaining: lineItem.quantityRemaining,
				notes: lineItem.notes,
				sortOrder: lineItem.sortOrder
			}))
			.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
	};
}
