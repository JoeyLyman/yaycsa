import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { OfferLineItem } from '../entities/offer-line-item.entity';
import { OfferService } from '../services/offer.service';

@Resolver('OfferLineItem')
export class OfferLineItemEntityResolver {
    constructor(private offerService: OfferService) {}

    @ResolveField()
    async quantityOrdered(@Ctx() ctx: RequestContext, @Parent() lineItem: OfferLineItem) {
        return this.offerService.getQuantityOrdered(ctx, lineItem.id);
    }

    @ResolveField()
    async quantityRemaining(@Ctx() ctx: RequestContext, @Parent() lineItem: OfferLineItem) {
        if (lineItem.quantityLimitMode === 'unlimited') {
            return null;
        }
        if (lineItem.quantityLimitMode === 'offer_specific' && lineItem.quantityLimit != null) {
            const ordered = await this.offerService.getQuantityOrdered(ctx, lineItem.id);
            return lineItem.quantityLimit - ordered;
        }
        // inventory_linked — deferred to Phase 3
        return null;
    }
}
