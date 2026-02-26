import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    CustomerGroup,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { In } from 'typeorm';

import { FulfillmentOption } from '../entities/fulfillment-option.entity';
import { Offer } from '../entities/offer.entity';
import { OfferLineItem } from '../entities/offer-line-item.entity';

export interface CreateOfferLineItemInput {
    productVariantId: ID;
    price: number;
    priceIncludesTax?: boolean;
    pricingMode?: 'tiered' | 'case';
    priceTiers?: any[] | null;
    quantityLimitMode?: 'unlimited' | 'offer_specific' | 'inventory_linked';
    quantityLimit?: number | null;
    autoConfirm?: boolean;
    notes?: string | null;
    sortOrder?: number;
}

export interface UpdateOfferLineItemInput {
    id: ID;
    price?: number;
    priceIncludesTax?: boolean;
    pricingMode?: 'tiered' | 'case';
    priceTiers?: any[] | null;
    quantityLimitMode?: 'unlimited' | 'offer_specific' | 'inventory_linked';
    quantityLimit?: number | null;
    autoConfirm?: boolean;
    notes?: string | null;
    sortOrder?: number;
}

export interface CreateOfferInput {
    validFrom: Date;
    validUntil?: Date | null;
    customerGroupFilterIds?: ID[];
    fulfillmentOptionIds: ID[];
    lineItems: CreateOfferLineItemInput[];
    allowLateOrders?: boolean;
    notes?: string | null;
    internalNotes?: string | null;
}

export interface UpdateOfferInput {
    id: ID;
    validFrom?: Date;
    validUntil?: Date | null;
    customerGroupFilterIds?: ID[];
    fulfillmentOptionIds?: ID[];
    allowLateOrders?: boolean;
    notes?: string | null;
    internalNotes?: string | null;
    addLineItems?: CreateOfferLineItemInput[];
    updateLineItems?: UpdateOfferLineItemInput[];
    removeLineItemIds?: ID[];
}

@Injectable()
export class OfferService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
    ) {}

    private readonly offerRelations = [
        'seller',
        'lineItems',
        'lineItems.productVariant',
        'fulfillmentOptions',
        'customerGroupFilters',
    ];

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<Offer>,
    ): Promise<PaginatedList<Offer>> {
        return this.listQueryBuilder
            .build(Offer, options, {
                ctx,
                channelId: ctx.channelId,
                relations: this.offerRelations,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<Offer | null> {
        const result = await this.connection.findOneInChannel(ctx, Offer, id, ctx.channelId, {
            relations: this.offerRelations,
        });
        return result ?? null;
    }

    /**
     * Find offers visible to the current buyer.
     * Show offer if customerGroupFilters is empty (public) OR buyer is in at least one filter group.
     */
    async findActiveForBuyer(ctx: RequestContext, sellerId?: ID): Promise<Offer[]> {
        const qb = this.connection
            .getRepository(ctx, Offer)
            .createQueryBuilder('offer')
            .leftJoinAndSelect('offer.channels', 'channel')
            .leftJoinAndSelect('offer.seller', 'seller')
            .leftJoinAndSelect('offer.lineItems', 'lineItem')
            .leftJoinAndSelect('lineItem.productVariant', 'productVariant')
            .leftJoinAndSelect('offer.fulfillmentOptions', 'fulfillmentOption')
            .leftJoinAndSelect('offer.customerGroupFilters', 'groupFilter')
            .where('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('offer.status = :status', { status: 'active' })
            .andWhere('offer.validFrom <= NOW()')
            .andWhere('(offer.validUntil IS NULL OR offer.validUntil > NOW())');

        if (sellerId) {
            qb.andWhere('offer.sellerId = :sellerId', { sellerId });
        }

        const offers = await qb.getMany();

        // Filter by customer group: show if no group filters OR buyer is in at least one group
        if (ctx.activeUserId) {
            const buyerGroupIds = await this.getBuyerGroupIds(ctx);
            return offers.filter(offer => {
                if (!offer.customerGroupFilters || offer.customerGroupFilters.length === 0) {
                    return true; // Public offer
                }
                return offer.customerGroupFilters.some(group =>
                    buyerGroupIds.includes(group.id),
                );
            });
        }

        // Unauthenticated: only show public offers (no group filters)
        return offers.filter(
            offer => !offer.customerGroupFilters || offer.customerGroupFilters.length === 0,
        );
    }

    async create(ctx: RequestContext, input: CreateOfferInput): Promise<Offer> {
        const sellerId = ctx.channel.sellerId;
        if (!sellerId) {
            throw new UserInputError('Cannot create offer without a seller channel');
        }

        // Validate customerGroupFilters belong to this seller or are global
        if (input.customerGroupFilterIds?.length) {
            await this.validateCustomerGroupFilters(ctx, input.customerGroupFilterIds, sellerId);
        }

        // Validate case pricing monotonicity
        for (const li of input.lineItems) {
            if (li.pricingMode === 'case' && li.priceTiers) {
                this.validateCasePricingMonotonicity(li.priceTiers);
            }
        }

        // Load fulfillment options
        const fulfillmentOptions = await this.connection
            .getRepository(ctx, FulfillmentOption)
            .find({ where: { id: In(input.fulfillmentOptionIds as number[]) } });

        // Load customer group filters
        let customerGroupFilters: CustomerGroup[] = [];
        if (input.customerGroupFilterIds?.length) {
            customerGroupFilters = await this.connection
                .getRepository(ctx, CustomerGroup)
                .find({ where: { id: In(input.customerGroupFilterIds as number[]) } });
        }

        const offer = new Offer({
            sellerId,
            status: 'draft',
            validFrom: input.validFrom,
            validUntil: input.validUntil ?? null,
            allowLateOrders: input.allowLateOrders ?? true,
            notes: input.notes ?? null,
            internalNotes: input.internalNotes ?? null,
            fulfillmentOptions,
            customerGroupFilters,
        });

        // Assign to seller's channel + default channel
        const sellerChannel = ctx.channel;
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        offer.channels = [sellerChannel, defaultChannel];

        const savedOffer = await this.connection.getRepository(ctx, Offer).save(offer);

        // Create line items
        const lineItems: OfferLineItem[] = [];
        for (let i = 0; i < input.lineItems.length; i++) {
            const li = input.lineItems[i];
            const lineItem = new OfferLineItem({
                offerId: savedOffer.id,
                productVariantId: li.productVariantId,
                price: li.price,
                priceIncludesTax: li.priceIncludesTax ?? false,
                pricingMode: li.pricingMode ?? 'tiered',
                priceTiers: li.priceTiers ?? null,
                quantityLimitMode: li.quantityLimitMode ?? 'unlimited',
                quantityLimit: li.quantityLimit ?? null,
                autoConfirm: li.autoConfirm ?? false,
                notes: li.notes ?? null,
                sortOrder: li.sortOrder ?? i,
            });
            lineItems.push(lineItem);
        }
        await this.connection.getRepository(ctx, OfferLineItem).save(lineItems);

        return this.findOne(ctx, savedOffer.id) as Promise<Offer>;
    }

    async update(ctx: RequestContext, input: UpdateOfferInput): Promise<Offer> {
        const existing = await this.findOne(ctx, input.id);
        if (!existing) {
            throw new UserInputError(`Offer with id '${input.id as string}' not found`);
        }

        if (input.validFrom !== undefined) existing.validFrom = input.validFrom;
        if (input.validUntil !== undefined) existing.validUntil = input.validUntil ?? null;
        if (input.allowLateOrders !== undefined) existing.allowLateOrders = input.allowLateOrders;
        if (input.notes !== undefined) existing.notes = input.notes ?? null;
        if (input.internalNotes !== undefined) existing.internalNotes = input.internalNotes ?? null;

        // Update fulfillment options
        if (input.fulfillmentOptionIds) {
            existing.fulfillmentOptions = await this.connection
                .getRepository(ctx, FulfillmentOption)
                .find({ where: { id: In(input.fulfillmentOptionIds as number[]) } });
        }

        // Update customer group filters
        if (input.customerGroupFilterIds !== undefined) {
            if (input.customerGroupFilterIds.length) {
                await this.validateCustomerGroupFilters(ctx, input.customerGroupFilterIds, existing.sellerId);
                existing.customerGroupFilters = await this.connection
                    .getRepository(ctx, CustomerGroup)
                    .find({ where: { id: In(input.customerGroupFilterIds as number[]) } });
            } else {
                existing.customerGroupFilters = [];
            }
        }

        await this.connection.getRepository(ctx, Offer).save(existing);

        // Remove line items
        if (input.removeLineItemIds?.length) {
            await this.connection
                .getRepository(ctx, OfferLineItem)
                .delete(input.removeLineItemIds as number[]);
        }

        // Update existing line items
        if (input.updateLineItems?.length) {
            for (const update of input.updateLineItems) {
                const lineItem = existing.lineItems.find(li => li.id === update.id);
                if (!lineItem) continue;

                if (update.price !== undefined) lineItem.price = update.price;
                if (update.priceIncludesTax !== undefined) lineItem.priceIncludesTax = update.priceIncludesTax;
                if (update.pricingMode !== undefined) lineItem.pricingMode = update.pricingMode;
                if (update.priceTiers !== undefined) lineItem.priceTiers = update.priceTiers;
                if (update.quantityLimitMode !== undefined) lineItem.quantityLimitMode = update.quantityLimitMode;
                if (update.quantityLimit !== undefined) lineItem.quantityLimit = update.quantityLimit;
                if (update.autoConfirm !== undefined) lineItem.autoConfirm = update.autoConfirm;
                if (update.notes !== undefined) lineItem.notes = update.notes ?? null;
                if (update.sortOrder !== undefined) lineItem.sortOrder = update.sortOrder;

                if (lineItem.pricingMode === 'case' && lineItem.priceTiers) {
                    this.validateCasePricingMonotonicity(lineItem.priceTiers);
                }
            }
            await this.connection.getRepository(ctx, OfferLineItem).save(
                input.updateLineItems.map(u => existing.lineItems.find(li => li.id === u.id)!).filter(Boolean),
            );
        }

        // Add new line items
        if (input.addLineItems?.length) {
            for (const li of input.addLineItems) {
                if (li.pricingMode === 'case' && li.priceTiers) {
                    this.validateCasePricingMonotonicity(li.priceTiers);
                }
            }
            const newItems = input.addLineItems.map(
                (li, i) =>
                    new OfferLineItem({
                        offerId: existing.id,
                        productVariantId: li.productVariantId,
                        price: li.price,
                        priceIncludesTax: li.priceIncludesTax ?? false,
                        pricingMode: li.pricingMode ?? 'tiered',
                        priceTiers: li.priceTiers ?? null,
                        quantityLimitMode: li.quantityLimitMode ?? 'unlimited',
                        quantityLimit: li.quantityLimit ?? null,
                        autoConfirm: li.autoConfirm ?? false,
                        notes: li.notes ?? null,
                        sortOrder: li.sortOrder ?? existing.lineItems.length + i,
                    }),
            );
            await this.connection.getRepository(ctx, OfferLineItem).save(newItems);
        }

        return this.findOne(ctx, existing.id) as Promise<Offer>;
    }

    async activate(ctx: RequestContext, id: ID): Promise<Offer> {
        const offer = await this.findOne(ctx, id);
        if (!offer) {
            throw new UserInputError(`Offer with id '${id as string}' not found`);
        }
        offer.status = 'active';
        await this.connection.getRepository(ctx, Offer).save(offer);
        return offer;
    }

    async pause(ctx: RequestContext, id: ID): Promise<Offer> {
        const offer = await this.findOne(ctx, id);
        if (!offer) {
            throw new UserInputError(`Offer with id '${id as string}' not found`);
        }
        offer.status = 'paused';
        await this.connection.getRepository(ctx, Offer).save(offer);
        return offer;
    }

    async expire(ctx: RequestContext, id: ID): Promise<Offer> {
        const offer = await this.findOne(ctx, id);
        if (!offer) {
            throw new UserInputError(`Offer with id '${id as string}' not found`);
        }
        offer.status = 'expired';
        await this.connection.getRepository(ctx, Offer).save(offer);
        return offer;
    }

    /**
     * Get the last active offer's line items for pre-filling a new offer.
     */
    async getPrefillData(ctx: RequestContext): Promise<Offer | null> {
        const result = await this.listQueryBuilder
            .build(Offer, { take: 1, sort: { createdAt: 'DESC' } }, {
                ctx,
                channelId: ctx.channelId,
                relations: this.offerRelations,
            })
            .andWhere('offer.status = :status', { status: 'active' })
            .getOne();
        return result ?? null;
    }

    /**
     * Compute quantityOrdered for an OfferLineItem.
     * Sum of OrderLine quantities where offerLineItemId matches,
     * lineStatus != 'cancelled', and Order state is not Cancelled or Draft.
     */
    async getQuantityOrdered(ctx: RequestContext, offerLineItemId: ID): Promise<number> {
        const result = await this.connection
            .getRepository(ctx, OfferLineItem)
            .query(
                `SELECT COALESCE(SUM(ol.quantity), 0)::int AS total
                 FROM order_line ol
                 JOIN "order" o ON ol."orderId" = o.id
                 WHERE ol."customFieldsOfferlineitemid" = $1
                   AND ol."customFieldsLinestatus" != 'cancelled'
                   AND o.state NOT IN ('Cancelled', 'Draft')`,
                [offerLineItemId],
            );
        return result[0]?.total ?? 0;
    }

    /**
     * Load an OfferLineItem with its parent offer + customer group filters.
     */
    async findOfferLineItemWithOffer(ctx: RequestContext, id: ID): Promise<OfferLineItem | null> {
        const lineItem = await this.connection
            .getRepository(ctx, OfferLineItem)
            .findOne({
                where: { id },
                relations: ['offer', 'offer.customerGroupFilters', 'productVariant'],
            });
        return lineItem ?? null;
    }

    /**
     * Validate that an offer is active, within validity window, and visible to the buyer.
     * Throws UserInputError if validation fails.
     */
    async validateOfferForBuyer(ctx: RequestContext, offer: Offer): Promise<void> {
        if (offer.status !== 'active') {
            throw new UserInputError('Offer is not active');
        }
        const now = new Date();
        if (offer.validFrom > now) {
            throw new UserInputError('Offer is not yet valid');
        }
        if (offer.validUntil && offer.validUntil <= now) {
            throw new UserInputError('Offer has expired');
        }
        if (offer.customerGroupFilters?.length > 0) {
            if (!ctx.activeUserId) {
                throw new UserInputError('This offer requires authentication');
            }
            const buyerGroupIds = await this.getBuyerGroupIds(ctx);
            const isInGroup = offer.customerGroupFilters.some(g =>
                buyerGroupIds.includes(g.id),
            );
            if (!isInGroup) {
                throw new UserInputError('You do not have access to this offer');
            }
        }
    }

    // --- Helpers ---

    async getBuyerGroupIds(ctx: RequestContext): Promise<ID[]> {
        if (!ctx.activeUserId) return [];
        const result = await this.connection
            .rawConnection
            .query(
                `SELECT cgc."customerGroupId" FROM customer_groups_customer_group cgc
                 JOIN customer c ON cgc."customerId" = c.id
                 WHERE c."userId" = $1`,
                [ctx.activeUserId],
            );
        return result.map((r: any) => r.customerGroupId);
    }

    /**
     * Validate that referenced customer groups are global or belong to the seller.
     */
    private async validateCustomerGroupFilters(
        ctx: RequestContext,
        groupIds: ID[],
        sellerId: ID,
    ): Promise<void> {
        const groups = await this.connection
            .getRepository(ctx, CustomerGroup)
            .find({ where: { id: In(groupIds as number[]) } });

        for (const group of groups) {
            const groupSellerId = (group.customFields as any)?.sellerId;
            if (groupSellerId && groupSellerId !== String(sellerId)) {
                throw new UserInputError(
                    `CustomerGroup '${group.name}' belongs to a different seller`,
                );
            }
        }
    }

    /**
     * Validate that larger case sizes have equal or better unit price.
     */
    private validateCasePricingMonotonicity(tiers: any[]): void {
        const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity);
        for (let i = 1; i < sorted.length; i++) {
            const prevUnitPrice = sorted[i - 1].casePrice / sorted[i - 1].quantity;
            const currUnitPrice = sorted[i].casePrice / sorted[i].quantity;
            if (currUnitPrice > prevUnitPrice) {
                throw new UserInputError(
                    `Case pricing must have non-increasing unit price for larger quantities. ` +
                    `Quantity ${sorted[i].quantity} has unit price ${currUnitPrice.toFixed(2)} ` +
                    `which is higher than quantity ${sorted[i - 1].quantity} at ${prevUnitPrice.toFixed(2)}`,
                );
            }
        }
    }
}
