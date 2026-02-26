import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { FulfillmentOptionService } from '../services/fulfillment-option.service';
import { OfferService } from '../services/offer.service';

@Resolver()
export class OfferAdminResolver {
    constructor(
        private fulfillmentOptionService: FulfillmentOptionService,
        private offerService: OfferService,
    ) {}

    // --- FulfillmentOption queries ---

    @Query()
    @Allow(Permission.ReadCatalog)
    async fulfillmentOptions(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.fulfillmentOptionService.findAll(ctx, args.options);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async fulfillmentOption(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.fulfillmentOptionService.findOne(ctx, args.id);
    }

    // --- FulfillmentOption mutations ---

    @Mutation()
    @Transaction()
    @Allow(Permission.CreateCatalog)
    async createFulfillmentOption(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.fulfillmentOptionService.create(ctx, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async updateFulfillmentOption(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.fulfillmentOptionService.update(ctx, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.DeleteCatalog)
    async deleteFulfillmentOption(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.fulfillmentOptionService.delete(ctx, args.id);
    }

    // --- Offer queries ---

    @Query()
    @Allow(Permission.ReadCatalog)
    async offers(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.offerService.findAll(ctx, args.options);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async offer(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.offerService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async offerPrefill(@Ctx() ctx: RequestContext) {
        return this.offerService.getPrefillData(ctx);
    }

    // --- Offer mutations ---

    @Mutation()
    @Transaction()
    @Allow(Permission.CreateCatalog)
    async createOffer(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.offerService.create(ctx, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async updateOffer(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.offerService.update(ctx, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async activateOffer(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.offerService.activate(ctx, args.id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async pauseOffer(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.offerService.pause(ctx, args.id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async expireOffer(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.offerService.expire(ctx, args.id);
    }
}
