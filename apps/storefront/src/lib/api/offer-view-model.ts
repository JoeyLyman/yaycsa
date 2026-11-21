/**
 * Normalized offer view-model shared by the customer-facing seller page and the
 * admin offers workspace, plus the adapters that produce it.
 *
 * Lives in the data layer (not with any UI component) so remote functions, any
 * design's components, and the Playwright test runner can all import it. Keep it
 * free of `$app` / `#lib` imports for that reason.
 *
 * Both data sources adapt into these types:
 * - Shop API `activeOffers` (public seller page) — populates buyer-facing fields
 *   only; admin-only fields stay `undefined`.
 * - Admin proxy offers query (`/me/offers`) — populates the full superset.
 *
 * A parity test asserts that, for the same offer, the buyer-facing subset is
 * identical whichever source produced it. Admin-only fields are optional so the
 * shop adapter can omit them and Customer view can ignore them.
 *
 * Enums here mirror the offer plugin's admin/shop GraphQL schema exactly
 * (`apps/server/src/plugins/offer-plugin/api/api-extensions.ts`) — keep them in
 * sync with that schema, not with any looser storefront guess.
 */

/** Offer lifecycle status. Customers only ever see `active` offers. */
export type OfferStatus = 'draft' | 'active' | 'paused' | 'expired';

/** Fulfillment method for an offer's fulfillment options. */
export type OfferFulfillmentType = 'scheduled_pickup' | 'scheduled_delivery' | 'shipping';

/** Day of week as stored on fulfillment options (server `Weekday` enum). */
export type OfferWeekday =
	'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** How an offer line item's price is computed (server `PricingMode` enum). */
export type OfferPricingMode = 'tiered' | 'case';

/** How an offer line item caps quantity (server `QuantityLimitMode` enum). */
export type OfferQuantityLimitMode = 'unlimited' | 'offer_specific' | 'inventory_linked';

/** A fulfillment option attached to an offer, as shown in both views. */
export interface OfferFulfillmentOptionView {
	id: string;
	name: string;
	type: OfferFulfillmentType;
	/** Buyer-facing note on the option, if any. */
	notes: string | null;
	/** Timing fields — all buyer-facing. Times are minutes-from-midnight. */
	fulfillmentWeekday: OfferWeekday | null;
	fulfillmentTimeWindowStart: number | null;
	fulfillmentTimeWindowEnd: number | null;
	orderDeadlineWeekday: OfferWeekday | null;
	orderDeadlineTime: number | null;
}

/** A single line item within an offer. */
export interface OfferLineItemView {
	id: string;
	/** Product variant identity + unit (buyer-facing). */
	productVariantId: string;
	productVariantName: string;
	productVariantSku: string;
	unitType: string | null;
	/** Unit price in cents (buyer-facing). */
	price: number;
	priceIncludesTax: boolean;
	pricingMode: OfferPricingMode;
	/** Raw tier payload as stored on the line item (buyer-facing when tiered/case). */
	priceTiers: unknown;
	/** Quantity still available to buy — shown to customers as "available". */
	quantityRemaining: number | null;
	/** Buyer-facing line note, if any. */
	notes: string | null;
	sortOrder: number;

	// --- Admin-only (undefined in Customer view / shop-sourced data) ---
	/** How this line caps quantity. */
	quantityLimitMode?: OfferQuantityLimitMode;
	/** The configured quantity cap, if limited. */
	quantityLimit?: number | null;
	/** Quantity already committed by buyers — a seller commitment metric. */
	quantityOrdered?: number | null;
	/** Whether orders on this line auto-confirm without seller review. */
	autoConfirm?: boolean;
}

/** A full offer as rendered by the shared `offer-list` bundle in either audience. */
export interface OfferListItem {
	id: string;
	sellerId: string;
	sellerName: string;
	/** Offer validity window (buyer-facing). */
	validFrom: string;
	validUntil: string | null;
	/** Whether late orders are accepted after the deadline (buyer-facing). */
	allowLateOrders: boolean;
	/** Offer-level note shown above the line items (buyer-facing). */
	notes: string | null;
	fulfillmentOptions: OfferFulfillmentOptionView[];
	lineItems: OfferLineItemView[];

	// --- Admin-only (undefined in Customer view / shop-sourced data) ---
	/** Lifecycle status. Customers implicitly only see `active`; admins see all. */
	status?: OfferStatus;
	/** Seller-private note, never surfaced to buyers. */
	internalNotes?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Adapters from the two raw offer payloads (Shop API `activeOffers` and the
// Admin proxy offers query) into the shared OfferListItem view-model.
//
// Both normalizers produce an identical buyer-facing subset for the same offer;
// the admin normalizer additionally fills the admin-only fields. The offer
// parity test (`tests/offer-parity.spec.ts`) leans on buyerFacingOfferView to
// assert that guarantee against real data from both APIs.
// ---------------------------------------------------------------------------

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
