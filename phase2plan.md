Claude’s Plan
Plan: Offers System (Item Upload & Availability)
Context
YAYCSA multi-vendor food marketplace. Phase 2 on fresh Vendure scaffold.

Core principles:

Offers are mandatory for buying — a customer can't order without an active offer. Sellers can have zero active offers (nothing to sell right now).
Offer → OfferLineItem[] (1:many), mirrors Vendure's Order → OrderLine[]
One Vendure Channel per seller (admin isolation). Sales segmentation handled by customer groups + fulfillment options on offers, NOT by multiple channels.
One seller order = one offer — Vendure's native aggregate order pattern: buyer sees one cart/checkout, but behind the scenes each seller+offer combination is a separate sub-order. Cart UI shows sections per seller+offer+fulfillment.
Inventory is opt-in — line items can be unlimited, offer-capped, or linked to Vendure's built-in StockLevel
Prices on offer line items — per-offer, defaults from last offer. Two pricing modes: tiered (unit price drops at qty thresholds) and case (discrete package sizes, greedy auto-pack)
No derived/denormalized DB fields — compute everything on read
No data duplication — no syncing Offer prices to ProductVariantPrice. Pricing strategy reads from Offer directly.
Table-based UI — wholesale = spreadsheet, not Shopify. Inline editing, bulk ops, images optional/toggleable.
Unified accounts — no business type selection, roles emerge from actions
Convention: All dates/times in the database use timestamptz (Postgres timestamp with time zone), stored in UTC, always with full date + time. No bare dates, no bare times, even when it feels like overkill. Consistency prevents timezone bugs when server, DB, and clients are in different zones.

Step 1: Custom Fields in vendure-config.ts
ProductVariant:

unitType: string dropdown (ct, lb, oz, pt, cs) — standardized unit for cross-seller aggregation. No unitLabel — packaging info goes in variant name.
Customer:

notes: text, nullable — global notes only. Per-vendor prefs on Orders.
Seller:

timezone: string — IANA timezone (e.g., America/Los_Angeles). Used for recurrence/deadline calculations. Stored dates are UTC, but "Wednesday 8am" means 8am in the seller's timezone.
CustomerGroup:

sellerId: string, nullable — scopes group to a seller
Order:

offerId: string, nullable — links to the Offer this (seller) order was placed against. Enables easy querying/reporting.
fulfillmentOptionId: string, nullable — which FulfillmentOption was selected for this order
OrderLine:

offerLineItemId: string, nullable — links to the OfferLineItem
lineStatus: string enum (pending, confirmed, adjusted, cancelled), default pending
selectedCaseQuantity: int, nullable — for case pricing: which case size selected
agreedUnitPrice: int (Money, cents), nullable — snapshot of the unit price at order placement. Used to detect offer price changes after order was placed.
Step 2: Entities
FulfillmentOption
A proper entity for delivery/pickup options. Sellers create their own. Offers reference a subset.

Field Type Notes
id, createdAt, updatedAt VendureEntity
channels Channel[] (M2M) ChannelAware — required for Vendure's query scoping (see note below)
seller → sellerId Seller (M2O) TypeORM relation + FK column (one DB column, two access paths)
code string Machine-readable: pdx_thu_delivery
name string Display: "Portland Thursday Delivery"
type enum: pickup, delivery Expandable later (partner delivery, USPS, etc.)
description text, nullable Address, time window, details
active boolean, default true
sortOrder int, default 0 Display order in UI. Standard Vendure pattern.
recurrence enum: once, daily, weekly, every_2_weeks, every_4_weeks, every_8_weeks, every_12_weeks, nullable null = no schedule (e.g., USPS).
fulfillmentStartDate timestamptz, nullable First/template occurrence window start. Day-of-week and time-of-day are derived from this for recurring patterns. Also serves as the anchor date for multi-week recurrences.
fulfillmentEndDate timestamptz, nullable First/template occurrence window end.
fulfillmentTimeDescription text, nullable Optional freeform for unscheduled fulfillment (USPS, "ships within 3 business days", etc.).
deadlineOffsetHours int, nullable Hours before fulfillmentStartDate that orders must be placed. null = no deadline. E.g., 48 = order by Monday 8am for Wednesday 8am delivery.
Note on seller + sellerId pattern: In the database there is ONE column: sellerId (the FK). The seller property is a TypeORM decorator that lets you load the full Seller object via ORM. Not data duplication — same column, two access methods. This is standard Vendure/TypeORM convention used on all entities below.

Note on channels (ChannelAware): Even though sellerId identifies the owner, Vendure's query infrastructure (findOneInChannel, ListQueryBuilder with channelId) requires the entity to implement ChannelAware with a channels M2M relation. This is how Vendure automatically scopes queries — when a seller admin hits the API, their ctx.channelId is used to filter results. Without ChannelAware, you'd have to manually filter by sellerId in every query instead of using Vendure's built-in helpers. FulfillmentOption and Offer need this. OfferLineItem does NOT — it's always accessed via its parent Offer, so it inherits channel scoping through the join.

Offer (the container)
Field Type Notes
id, createdAt, updatedAt VendureEntity
channels Channel[] (M2M) ChannelAware (see note above)
seller → sellerId Seller (M2O)
status enum: draft, active, paused, expired
validFrom DateTime When offer activates
validUntil DateTime, nullable null = permanent (no expiry)
customerGroupFilters CustomerGroup[] (M2M), nullable Which groups can see/order. Empty = public. Proper M2M for referential integrity and ListQueryBuilder support.
fulfillmentOptions FulfillmentOption[] (M2M) Which fulfillment methods this offer supports
lineItems OfferLineItem[] (O2M) The products
allowLateOrders boolean, default true If past fulfillment deadline: true = accept but skip auto-confirm (seller must review everything), false = reject outright.
notes text, nullable Buyer-visible notes
internalNotes text, nullable Vendor-only
Editing active offers:

Active offers are freely editable (prices, line items, fulfillment options, notes, etc.).
agreedUnitPrice is snapshot on OrderLine at order placement. When seller edits offer prices, compare against snapshot:
Price UP: buyer gets automatic right to cancel (didn't agree to new price). Notify buyer.
Price DOWN: update order to new lower price (benefits buyer). Notify buyer.
Price SAME: no action needed.
Cancellation policy: buyers can REQUEST cancellation at any time. Seller approves or rejects. Exception: price increase → buyer can cancel without seller approval.
Paid orders are unaffected — Vendure locks pricing after payment settlement.
Implementation note: reactive price-change detection + notification + custom CancellationRequested order state are deferred to Phase 3. Phase 2 lays the data foundation (agreedUnitPrice field).
Deadline behavior:

When buyer adds item to order: check if any fulfillment option on the offer is past deadline. If ALL options are past deadline and allowLateOrders = false, reject. If allowLateOrders = true, accept but override autoConfirm to false for all line items.
"Next fulfillment date" is computed from recurrence + recurrenceDay + current date.
"Bulk set deadline" = UI operation. Seller picks a deadline offset, UI applies it to all selected fulfillment options.
Lifecycle rules:

Multiple active offers allowed. A seller can have several active offers simultaneously — e.g., one for restaurants (Thu delivery) and one for farmers market (Sat pickup), both targeting the same customers but with different items and fulfillment options.
Permanent offers (validUntil = null) stay active until manually paused or expired.
Soft expiry on read: queries filter validUntil IS NULL OR validUntil > now().
Simple setup: one permanent, public offer with all products.
Advanced setup: separate offers per fulfillment option, customer group, or time window.
OfferLineItem (per-product)
Field Type Notes
id, createdAt, updatedAt VendureEntity
offer → offerId Offer (M2O) Parent
productVariant → productVariantId ProductVariant (M2O) What product
price int (Money, cents) Base per-unit price
priceIncludesTax boolean
pricingMode enum: tiered, case Tiered = unit price drops at qty thresholds. Case = discrete package sizes. (flat is just tiered with one tier.)
priceTiers jsonb, nullable Price tier array (see below)
quantityLimitMode enum: unlimited, offer_specific, inventory_linked
quantityLimit decimal, nullable Max available for this offer. Used when quantityLimitMode = offer_specific.
autoConfirm boolean, default false
notes text, nullable Per-item buyer notes
sortOrder int, default 0 Display order within the offer table
Computed fields (NOT stored, resolved at query time):

quantityOrdered: sum of OrderLines where offerLineItemId = this.id AND lineStatus != 'cancelled' AND parent Order not cancelled/voided
quantityRemaining: for offer_specific = quantityLimit - ordered; for inventory_linked = StockLevel.stockOnHand - allocated; for unlimited = null
Price Tiers (jsonb)
pricingMode: 'tiered' — unit price drops at quantity thresholds. All units priced at the tier rate.

[
{ "minQuantity": 1, "unitPrice": 400 },
{ "minQuantity": 12, "unitPrice": 300 },
{ "minQuantity": 24, "unitPrice": 250 }
]
Example: 54 units → 24+ tier → 54 × $2.50 = $135.00

pricingMode: 'case' — discrete package sizes. System auto-packs using greedy algorithm (largest case first).

[
{ "quantity": 1, "casePrice": 400, "label": "each" },
{ "quantity": 12, "casePrice": 3600, "label": "case of 12" },
{ "quantity": 24, "casePrice": 6000, "label": "case of 24" }
]
Example: 54 units → 2×24ct ($120) + 6×1ct ($24) = $144.00. Each case-size chunk becomes a separate OrderLine for transparency.

Any number of case sizes per line item. Sellers can set explicit prices or apply rules ("10% off for 12+"). Bulk-editable across line items (spreadsheet-style).

Step 3: Services
OfferService
create(ctx, input) — Offer + OfferLineItems, status = draft
update(ctx, id, input) — update offer and/or line items
activate(ctx, id) — set status to active
pause(ctx, id) / expire(ctx, id)
findActiveForBuyer(ctx, sellerId?) — offers visible to current buyer. Logic: show offer if customerGroupFilters is empty (public) OR buyer is in at least one of the filter groups. M2M join with OR condition — test explicitly that public offers appear for all buyers including unauthenticated.
findBySeller(ctx) — seller's own offers (admin, scoped by channel)
getPrefillData(ctx) — last active offer's line items for pre-filling a new offer
FulfillmentOptionService
CRUD, scoped to seller's channel
Pricing Logic (in OfferPriceCalculationStrategy)
Custom OrderItemPriceCalculationStrategy — Vendure calls this per order line:

Look up OfferLineItem via orderLine.customFields.offerLineItemId
If not found → reject (offers mandatory)
Tiered: find tier where minQuantity <= quantity, return tierUnitPrice
Case: use selectedCaseQuantity from OrderLine custom fields to find the matching case tier, return casePrice / quantity as unit price
For case mode, the frontend (or order creation logic) splits an order of 54 into multiple OrderLines: 2 lines of 24ct + 6 lines of 1ct (or 1 line qty=2 at 24ct price + 1 line qty=6 at 1ct price). Each OrderLine has a selectedCaseQuantity so the strategy knows which tier to use.

GraphQL API
Admin API (seller dashboard):

Query: offers(options): OfferList!
Query: offer(id): Offer (with lineItems)
Query: offerPrefill: OfferPrefillResult!
Query: fulfillmentOptions: FulfillmentOptionList!
Mutation: createOffer(input): Offer!
Mutation: updateOffer(id, input): Offer!
Mutation: activateOffer(id): Offer!
Mutation: pauseOffer(id): Offer!
Mutation: expireOffer(id): Offer!
CRUD mutations for FulfillmentOption
Shop API (buyer):

Query: activeOffers(sellerId: ID): [Offer!]! — offers visible to buyer (filtered by group membership)
Query: offerLineItem(id: ID!): OfferLineItem
Computed fields on OfferLineItem:

quantityOrdered: Float
quantityRemaining: Float (null if unlimited)
Step 4: OrderLine Integration
Order confirmation flow:

Order placed → line items pending
If offerLineItem.autoConfirm = true → confirmed immediately
Seller reviews: confirm, adjust qty, or cancel per line item
Different offers have different order windows (wholesale = weekly, restaurant = twice/week)
Testing: All via GraphiQL (Admin + Shop API). Frontend is Phase 4.

Step 5: Migrations & Seed
cd apps/server && npx vendure migrate -g "add-custom-fields"
npx vendure migrate -g "add-offer-entities"
npx vendure migrate -r
Seed: one test vendor (GTF), one channel, products (no categories yet), fulfillment options, sample offer
Plugin Structure

apps/server/src/plugins/offer-plugin/
├── offer.plugin.ts
├── entities/
│ ├── offer.entity.ts
│ ├── offer-line-item.entity.ts
│ └── fulfillment-option.entity.ts
├── services/
│ ├── offer.service.ts
│ └── fulfillment-option.service.ts
├── strategies/
│ └── offer-price-calculation.strategy.ts
├── api/
│ ├── api-extensions.ts
│ ├── offer-admin.resolver.ts
│ └── offer-shop.resolver.ts
└── types.ts
Implementation Order
Custom fields in vendure-config.ts
Entities (Offer, OfferLineItem, FulfillmentOption) + plugin registration
Migrations
Seed data (one vendor, channel, products, fulfillment options)
FulfillmentOptionService
OfferService (CRUD, activation, prefill, deadline validation)
GraphQL API (admin + shop resolvers)
OfferPriceCalculationStrategy
Smoke test via GraphiQL
Invariants (must be enforced in code)
One seller order = one offer. All OrderLines in a seller sub-order must belong to the same Offer. Enforce in addItemToOrder wrapper — if order already has offerId, reject items from a different offer.
Order.fulfillmentOptionId must belong to the order's offer. Validate that the selected fulfillment option is in the offer's fulfillmentOptions M2M.
Order.fulfillmentOptionId must be set before payment transition. Guard the ArrangingPayment state transition.
Offer must be active at order placement. Check status = active and soft expiry (validUntil IS NULL OR > now()).
Deadline validated at state transition. Re-check deadline at ArrangingPayment, not just at add-to-cart.
Quantity lock is transactional. For offer_specific limits, SELECT ... FOR UPDATE on OfferLineItem within the order transition transaction.
No OrderLine without offerLineItemId. Pricing strategy rejects if missing.
Recurrence is anchor-based. Multi-week recurrences (every_2_weeks, every_4_weeks, etc.) count from fulfillmentStartDate, not from calendar week parity.
Recurrence calculations use seller timezone. Convert fulfillmentStartDate to seller's IANA timezone before computing next occurrence/deadline.
Gotchas & Implementation Notes
OrderLine merging (case pricing): Vendure's addItemToOrder compares custom fields when deciding whether to merge or create a new OrderLine. Since different case sizes have different selectedCaseQuantity values, they'll naturally stay as separate OrderLines. Verify this during testing.

Race conditions (offer_specific limits): When two buyers order simultaneously against a limited-quantity line item, use SELECT ... FOR UPDATE on OfferLineItem row within a DB transaction at order state transition time (e.g., before ArrangingPayment).

Tax handling: Our OrderItemPriceCalculationStrategy only overrides price, not tax. Vendure applies tax rules from the ProductVariant's TaxCategory independently — no special handling needed.

Case pricing monotonicity: Validate in OfferService.create/update that larger case sizes have equal or better unit price. The greedy auto-pack algorithm depends on this invariant.

Aggregate orders: Vendure natively splits multi-seller carts into seller sub-orders. We extend this so each sub-order maps to one offer. Use OrderService.getSellerOrders() and getAggregateOrder().

DB indexes needed: offerLineItemId on OrderLine custom field, offerId on Order custom field, sellerId on Offer/FulfillmentOption entities.

Deferred
Feature Notes
Product categories Save to apps/docs/library/yaycsa/features/product-categories.md
Fulfillment options deep design Save to feature doc — types (partner delivery, USPS, etc.)
Custom InventoryPlugin Lot tracking, processing pipeline, traceability
Customer group auto-matching Business type matching, request system, approval flow
Customer group pricing Different tier per group on same line item
Offer versioning/audit trail Snapshot offer state per order for historical accuracy
Cancellation request flow Custom OrderProcess with CancellationRequested state, reactive price-change detection, buyer notifications
Offer email/SMS blast Phase 6
Frontend Phase 4
Docs Updates (on approval)
Create apps/docs/library/yaycsa/plugins/ folder (sibling to features/)
Create apps/docs/library/yaycsa/plugins/offer-plugin.md — full version of this plan as the canonical plugin doc
Create apps/docs/library/yaycsa/features/product-categories.md (Joe's category list for later)
Create apps/docs/library/yaycsa/features/fulfillment-options.md (types, scheduling, deadlines — deferred deep design)
Update apps/docs/todos/yaycsa.md Phase 2 tasks
Add timezone convention to CLAUDE.md: all dates in DB are timestamptz, stored UTC, always full date+time
Create apps/docs/library/yaycsa/data-conventions.md — DB date/time convention (timestamptz, UTC, consistency) + any other schema conventions
Verification
npm run dev — Vendure boots clean
Tables exist: offer, offer_line_item, fulfillment_option
Seed data visible in dashboard
GraphiQL:
Create fulfillment options
Create offer with line items (tiered + case pricing modes)
Activate → verify status = active
Shop API: activeOffers returns correct offers for buyer's groups
quantityOrdered = 0, quantityRemaining = quantityLimit or null
Add item to order → pricing strategy returns correct price from offer
Case pricing: 54 units auto-packs into 2×24ct + 6×1ct (separate OrderLines, not merged)
Permanent offer: validUntil = null stays active indefinitely
Auto-confirm: place order against autoConfirm line item → lineStatus = confirmed
