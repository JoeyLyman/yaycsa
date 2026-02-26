import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    ActiveOrderService,
    Allow,
    Ctx,
    ID,
    OrderService,
    Permission,
    RequestContext,
    Transaction,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { OfferLineItem } from '../entities/offer-line-item.entity';
import { OfferService } from '../services/offer.service';
import type { CasePriceTier, TieredPriceTier } from '../types';

@Resolver()
export class OfferShopResolver {
    constructor(
        private offerService: OfferService,
        private orderService: OrderService,
        private activeOrderService: ActiveOrderService,
        private connection: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async activeOffers(@Ctx() ctx: RequestContext, @Args() args: { sellerId?: string }) {
        return this.offerService.findActiveForBuyer(ctx, args.sellerId);
    }

    @Query()
    @Allow(Permission.Public)
    async offerLineItem(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        const lineItem = await this.offerService.findOfferLineItemWithOffer(ctx, args.id);
        if (!lineItem) return null;

        // Validate parent offer is active + within validity + visible to buyer
        const offer = lineItem.offer;
        if (offer.status !== 'active') return null;
        const now = new Date();
        if (offer.validFrom > now) return null;
        if (offer.validUntil && offer.validUntil <= now) return null;

        // Visibility: public offers visible to all, group-filtered offers only to members
        if (offer.customerGroupFilters?.length > 0) {
            if (!ctx.activeUserId) return null;
            const buyerGroupIds = await this.offerService.getBuyerGroupIds(ctx);
            const isInGroup = offer.customerGroupFilters.some(g =>
                buyerGroupIds.includes(g.id),
            );
            if (!isInGroup) return null;
        }

        return lineItem;
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Owner)
    async addOfferItemToOrder(
        @Ctx() ctx: RequestContext,
        @Args()
        args: {
            offerLineItemId: string;
            quantity: number;
            selectedCaseQuantity?: number;
            buyerNotes?: string;
        },
    ) {
        // 1. Load the OfferLineItem with its offer
        const lineItem = await this.offerService.findOfferLineItemWithOffer(ctx, args.offerLineItemId);
        if (!lineItem) {
            throw new UserInputError('Offer line item not found');
        }
        const offer = lineItem.offer;

        // 2. Validate offer is active + within validity + visible to buyer
        await this.offerService.validateOfferForBuyer(ctx, offer);

        // 3. Check quantity limits
        if (lineItem.quantityLimitMode === 'offer_specific' && lineItem.quantityLimit != null) {
            const ordered = await this.offerService.getQuantityOrdered(ctx, lineItem.id);
            const remaining = lineItem.quantityLimit - ordered;
            if (args.quantity > remaining) {
                throw new UserInputError(
                    `Quantity ${args.quantity} exceeds available quantity (${remaining} remaining)`,
                );
            }
        }

        // 4. Validate case pricing args
        if (lineItem.pricingMode === 'case') {
            if (!args.selectedCaseQuantity) {
                throw new UserInputError('selectedCaseQuantity is required for case pricing');
            }
            const tiers = lineItem.priceTiers as CasePriceTier[] | null;
            if (!tiers?.find(t => t.quantity === args.selectedCaseQuantity)) {
                throw new UserInputError(`Invalid case quantity: ${args.selectedCaseQuantity}`);
            }
        }

        // 5. Get or create active order
        const order = await this.activeOrderService.getOrderFromContext(ctx, true);

        // 6. Enforce one-offer-per-seller-order (invariant #1)
        // Check if any existing order line from the same seller uses a different offer
        await this.enforceOneOfferPerSeller(ctx, order.id, offer.id, offer.sellerId);

        // 7. Calculate agreedUnitPrice snapshot
        const agreedUnitPrice = this.calculateAgreedUnitPrice(
            lineItem, args.quantity, args.selectedCaseQuantity,
        );

        // 8. Add item to order via Vendure's OrderService
        const result = await this.orderService.addItemToOrder(
            ctx,
            order.id,
            lineItem.productVariantId,
            args.quantity,
            {
                offerLineItemId: lineItem.id,
                lineStatus: lineItem.autoConfirm ? 'confirmed' : 'pending',
                selectedCaseQuantity: args.selectedCaseQuantity ?? null,
                agreedUnitPrice,
                buyerNotes: args.buyerNotes ?? null,
            },
        );

        // 9. Handle Vendure error results
        if ('errorCode' in result) {
            throw new UserInputError((result as any).message);
        }

        return result;
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Owner)
    async adjustOfferItemQuantity(
        @Ctx() ctx: RequestContext,
        @Args() args: { orderLineId: string; quantity: number },
    ) {
        // 1. Get active order
        const order = await this.activeOrderService.getOrderFromContext(ctx);
        if (!order) {
            throw new UserInputError('No active order found');
        }

        // 2. Load the order line's offerLineItemId, current quantity, and selectedCaseQuantity
        const lineData = await this.connection.rawConnection.query(
            `SELECT ol."customFieldsOfferlineitemid" AS "offerLineItemId",
                    ol.quantity,
                    ol."orderId",
                    ol."customFieldsSelectedcasequantity" AS "selectedCaseQuantity"
             FROM order_line ol WHERE ol.id = $1`,
            [args.orderLineId],
        );
        if (!lineData[0] || String(lineData[0].orderId) !== String(order.id)) {
            throw new UserInputError('Order line not found in active order');
        }
        const offerLineItemId: ID = lineData[0].offerLineItemId;
        const currentQty: number = lineData[0].quantity;
        if (!offerLineItemId) {
            throw new UserInputError('Order line has no associated offer line item');
        }

        // 3. Load the OfferLineItem with its offer
        const lineItem = await this.offerService.findOfferLineItemWithOffer(ctx, offerLineItemId);
        if (!lineItem) {
            throw new UserInputError('Offer line item not found');
        }

        // 4. Validate offer is still active + visible
        await this.offerService.validateOfferForBuyer(ctx, lineItem.offer);

        // 5. Re-validate quantity limits with new quantity
        if (lineItem.quantityLimitMode === 'offer_specific' && lineItem.quantityLimit != null) {
            const ordered = await this.offerService.getQuantityOrdered(ctx, lineItem.id);
            // ordered includes currentQty, so available for this line = limit - ordered + currentQty
            const available = lineItem.quantityLimit - ordered + currentQty;
            if (args.quantity > available) {
                throw new UserInputError(
                    `Quantity ${args.quantity} exceeds available quantity (${available} available)`,
                );
            }
        }

        // 6. Re-calculate agreedUnitPrice for the new quantity (tier may have changed)
        const agreedUnitPrice = this.calculateAgreedUnitPrice(
            lineItem, args.quantity, lineData[0].selectedCaseQuantity,
        );

        // 7. Adjust via Vendure's OrderService with updated agreedUnitPrice
        const result = await this.orderService.adjustOrderLine(
            ctx,
            order.id,
            args.orderLineId,
            args.quantity,
            { agreedUnitPrice },
        );

        if ('errorCode' in result) {
            throw new UserInputError((result as any).message);
        }

        return result;
    }

    // --- Private helpers ---

    /**
     * Enforce invariant #1: one offer per seller within an order.
     * If any existing order line from the same seller uses a different offer, reject.
     */
    private async enforceOneOfferPerSeller(
        ctx: RequestContext,
        orderId: ID,
        offerId: ID,
        sellerId: ID,
    ): Promise<void> {
        const result = await this.connection.rawConnection.query(
            `SELECT COUNT(*) AS count FROM order_line ol
             JOIN offer_line_item oli ON ol."customFieldsOfferlineitemid" = oli.id
             JOIN offer o ON oli."offerId" = o.id
             WHERE ol."orderId" = $1
               AND o."sellerId" = $2
               AND oli."offerId" != $3`,
            [orderId, sellerId, offerId],
        );
        if (parseInt(result[0].count, 10) > 0) {
            throw new UserInputError(
                'Cannot add items from a different offer of the same seller to this order',
            );
        }
    }

    /**
     * Calculate the unit price snapshot based on pricing mode and quantity.
     * For tiered: find the highest tier where minQuantity <= quantity.
     * For case: find the matching case tier by selectedCaseQuantity.
     * Fallback: base price from the offer line item.
     */
    private calculateAgreedUnitPrice(
        lineItem: OfferLineItem,
        quantity: number,
        selectedCaseQuantity?: number,
    ): number {
        if (lineItem.pricingMode === 'case' && selectedCaseQuantity && lineItem.priceTiers) {
            const caseTier = (lineItem.priceTiers as CasePriceTier[])
                .find(t => t.quantity === selectedCaseQuantity);
            if (caseTier) {
                return Math.round(caseTier.casePrice / caseTier.quantity);
            }
        }

        if (lineItem.pricingMode === 'tiered' && lineItem.priceTiers?.length) {
            const tiers = [...(lineItem.priceTiers as TieredPriceTier[])]
                .sort((a, b) => b.minQuantity - a.minQuantity);
            const tier = tiers.find(t => t.minQuantity <= quantity);
            if (tier) {
                return tier.unitPrice;
            }
        }

        // Fallback: base price
        return lineItem.price;
    }
}
