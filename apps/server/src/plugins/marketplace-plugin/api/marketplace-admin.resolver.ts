import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { MarketplaceService } from '../services/marketplace.service';

@Resolver()
export class MarketplaceAdminResolver {
    constructor(private marketplaceService: MarketplaceService) {}

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async syncProductFacetValues(
        @Ctx() ctx: RequestContext,
        @Args() args: { productId: string; facetValueIds: string[] },
    ): Promise<boolean> {
        await this.marketplaceService.syncProductFacetValues(
            ctx,
            args.productId,
            args.facetValueIds,
        );
        return true;
    }
}
