/**
 * Normalized offer view-model shared by the customer-facing seller page and the
 * admin offers workspace.
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
	| 'monday'
	| 'tuesday'
	| 'wednesday'
	| 'thursday'
	| 'friday'
	| 'saturday'
	| 'sunday';

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
