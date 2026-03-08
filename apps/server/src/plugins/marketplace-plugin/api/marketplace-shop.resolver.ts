import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { MarketplaceService } from '../services/marketplace.service';

@Resolver()
export class MarketplaceShopResolver {
    constructor(private marketplaceService: MarketplaceService) {}

    @Query()
    @Allow(Permission.Public)
    async sellers(
        @Ctx() ctx: RequestContext,
        @Args() args: { activeOffersOnly?: boolean },
    ) {
        return this.marketplaceService.findSellers(ctx, args.activeOffersOnly ?? true);
    }

    @Query()
    @Allow(Permission.Public)
    async sellerBySlug(
        @Ctx() ctx: RequestContext,
        @Args() args: { slug: string },
    ) {
        return this.marketplaceService.findSellerBySlug(ctx, args.slug);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async becomeSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { shopName: string; slug: string } },
    ) {
        return this.marketplaceService.becomeSeller(ctx, args.input);
    }
}
