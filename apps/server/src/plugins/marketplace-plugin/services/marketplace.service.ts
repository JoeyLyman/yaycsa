import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ID,
    RequestContext,
    Seller,
    TransactionalConnection,
} from '@vendure/core';
import { IsNull, Not } from 'typeorm';

import { Offer } from '../../offer-plugin/entities/offer.entity';

export interface ShopSeller {
    id: ID;
    name: string;
    slug: string | null;
}

@Injectable()
export class MarketplaceService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
    ) {}

    /**
     * Find sellers visible on the marketplace.
     *
     * When activeOffersOnly is true (default), returns only sellers with at least
     * one currently-valid offer on the default channel.
     * "Currently-valid" = status='active' AND validFrom <= NOW() AND (validUntil IS NULL OR validUntil > NOW()).
     *
     * Both modes exclude sellers with null slugs (not navigable).
     */
    async findSellers(ctx: RequestContext, activeOffersOnly = true): Promise<ShopSeller[]> {
        if (activeOffersOnly) {
            return this.findSellersWithActiveOffers(ctx);
        }
        // All sellers with non-null slugs
        const sellers = await this.connection
            .getRepository(ctx, Seller)
            .find({
                where: {
                    customFields: { slug: Not(IsNull()) },
                    deletedAt: IsNull(),
                },
            });
        return sellers.map(s => this.toShopSeller(s));
    }

    /**
     * Find a seller by their URL slug.
     */
    async findSellerBySlug(ctx: RequestContext, slug: string): Promise<ShopSeller | null> {
        const seller = await this.connection
            .getRepository(ctx, Seller)
            .findOne({
                where: {
                    customFields: { slug },
                    deletedAt: IsNull(),
                },
            });
        return seller ? this.toShopSeller(seller) : null;
    }

    private async findSellersWithActiveOffers(ctx: RequestContext): Promise<ShopSeller[]> {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);

        // Find distinct seller IDs from currently-valid offers on the default channel
        const rows: Array<{ sellerId: number }> = await this.connection
            .getRepository(ctx, Offer)
            .createQueryBuilder('offer')
            .select('DISTINCT offer.sellerId', 'sellerId')
            .innerJoin('offer.channels', 'channel', 'channel.id = :channelId', {
                channelId: defaultChannel.id,
            })
            .where('offer.status = :status', { status: 'active' })
            .andWhere('offer.validFrom <= NOW()')
            .andWhere('(offer.validUntil IS NULL OR offer.validUntil > NOW())')
            .getRawMany();

        if (rows.length === 0) return [];

        const sellerIds = rows.map(r => r.sellerId);

        // Load seller entities, excluding those without slugs
        const sellers = await this.connection
            .getRepository(ctx, Seller)
            .createQueryBuilder('seller')
            .where('seller.id IN (:...sellerIds)', { sellerIds })
            .andWhere('seller.customFields.slug IS NOT NULL')
            .andWhere('seller.deletedAt IS NULL')
            .getMany();

        return sellers.map(s => this.toShopSeller(s));
    }

    private toShopSeller(seller: Seller): ShopSeller {
        return {
            id: seller.id,
            name: seller.name,
            slug: (seller.customFields as any).slug ?? null,
        };
    }
}
