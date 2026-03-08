import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ConfigService,
    Customer,
    CurrencyCode,
    ForbiddenError,
    ID,
    InternalServerError,
    LanguageCode,
    RequestContext,
    RequestContextService,
    Seller,
    SellerService,
    TransactionalConnection,
    User,
} from '@vendure/core';
import crypto from 'crypto';
import { IsNull, Not } from 'typeorm';

import { Offer } from '../../offer-plugin/entities/offer.entity';
import { MarketplacePlugin } from '../marketplace.plugin';

/** Slugs that collide with current or likely future top-level routes. Add any new top-level routes here. */
const RESERVED_SLUGS = [
    'me', 'login', 'register', 'verify', 'reset-password', 'forgot-password',
    'admin', 'api', 'assets', 'graphiql', 'dashboard', 'mailbox', 'shop-api', 'admin-api',
    'checkout', 'cart', 'order', 'orders', 'about', 'search', 'sellers', 'privacy', 'terms',
    'help', 'support', 'contact', 'faq', 'blog', 'docs',
];

/** Slug format: lowercase alphanumeric + hyphens, 3–60 chars, no leading/trailing/double hyphens. */
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

export interface ShopSeller {
    id: ID;
    name: string;
    slug: string | null;
}

type BecomeSellerResult =
    | { __typename: 'BecomeSellerSuccess'; seller: ShopSeller }
    | { __typename: 'SlugAlreadyTakenError'; errorCode: string; message: string }
    | { __typename: 'AlreadyASellerError'; errorCode: string; message: string }
    | { __typename: 'InvalidSlugError'; errorCode: string; message: string }
    | { __typename: 'SellerRegistrationClosedError'; errorCode: string; message: string };

@Injectable()
export class MarketplaceService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
        private sellerService: SellerService,
        private configService: ConfigService,
        private requestContextService: RequestContextService,
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

    /**
     * Let an authenticated customer create a Seller + Channel and link their account.
     * All three operations are wrapped in a transaction — all succeed or none persist.
     */
    async becomeSeller(
        ctx: RequestContext,
        input: { shopName: string; slug: string },
    ): Promise<BecomeSellerResult> {
        // 1. Config guard
        if (!MarketplacePlugin.options.allowOpenSellerRegistration) {
            return {
                __typename: 'SellerRegistrationClosedError',
                errorCode: 'SELLER_REGISTRATION_CLOSED',
                message: 'Seller registration is currently closed.',
            };
        }

        // 2. Auth guard
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }

        // 3. Already-a-seller guard
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .findOne({
                where: { user: { id: ctx.activeUserId } },
                relations: ['customFields.seller'],
            });
        if (!customer) {
            throw new InternalServerError('No customer found for active user');
        }
        if ((customer.customFields as any).seller) {
            return {
                __typename: 'AlreadyASellerError',
                errorCode: 'ALREADY_A_SELLER',
                message: 'This account is already linked to a seller.',
            };
        }

        // 4. Validate slug format
        const slug = input.slug.toLowerCase();
        if (!SLUG_REGEX.test(slug) || slug.includes('--')) {
            return {
                __typename: 'InvalidSlugError',
                errorCode: 'INVALID_SLUG',
                message: 'Slug must be 3–60 characters, lowercase alphanumeric and hyphens only, no leading/trailing/double hyphens.',
            };
        }
        if (RESERVED_SLUGS.includes(slug)) {
            return {
                __typename: 'SlugAlreadyTakenError',
                errorCode: 'SLUG_ALREADY_TAKEN',
                message: `The slug "${slug}" is reserved.`,
            };
        }

        // Check uniqueness against existing sellers
        const existing = await this.connection
            .getRepository(ctx, Seller)
            .findOne({ where: { customFields: { slug } } });
        if (existing) {
            return {
                __typename: 'SlugAlreadyTakenError',
                errorCode: 'SLUG_ALREADY_TAKEN',
                message: `The slug "${slug}" is already taken.`,
            };
        }

        // 5. Build superadmin context for creating Seller/Channel
        const superadminIdentifier = this.configService.authOptions.superadminCredentials?.identifier;
        const superadminUser = await this.connection
            .getRepository(ctx, User)
            .findOne({ where: { identifier: superadminIdentifier } });
        if (!superadminUser) {
            throw new InternalServerError(
                'Superadmin user not found. Check authOptions.superadminCredentials config.',
            );
        }
        const superAdminCtx = await this.requestContextService.create({
            apiType: 'admin',
            user: superadminUser,
        });

        // 6–9. Transaction: create Seller, create Channel, link Customer
        try {
            return await this.connection.withTransaction(ctx, async (transactionalCtx) => {
                // 7. Create Seller
                const seller = await this.sellerService.create(superAdminCtx, {
                    name: input.shopName,
                    customFields: { slug },
                });

                // 8. Create Channel — copy defaults from the default channel
                const defaultChannel = await this.channelService.getDefaultChannel(transactionalCtx);
                await this.channelService.create(superAdminCtx, {
                    code: slug,
                    sellerId: seller.id,
                    token: crypto.randomBytes(32).toString('hex'),
                    defaultLanguageCode: defaultChannel.defaultLanguageCode as LanguageCode,
                    currencyCode: defaultChannel.defaultCurrencyCode as CurrencyCode,
                    defaultCurrencyCode: defaultChannel.defaultCurrencyCode as CurrencyCode,
                    pricesIncludeTax: defaultChannel.pricesIncludeTax,
                    // TODO: Seller-specific zone configuration is a future concern.
                    // For now, copy defaults from the default channel.
                    defaultShippingZoneId: defaultChannel.defaultShippingZone?.id,
                    defaultTaxZoneId: defaultChannel.defaultTaxZone?.id,
                });

                // 9. Link Customer → Seller
                const customerRepo = this.connection.getRepository(transactionalCtx, Customer);
                (customer.customFields as any).seller = seller.id;
                await customerRepo.save(customer);

                return {
                    __typename: 'BecomeSellerSuccess' as const,
                    seller: this.toShopSeller(seller),
                };
            });
        } catch (err: any) {
            // Handle TOCTOU race on slug unique constraint
            if (err?.code === '23505' && err?.detail?.includes('slug')) {
                return {
                    __typename: 'SlugAlreadyTakenError',
                    errorCode: 'SLUG_ALREADY_TAKEN',
                    message: `The slug "${slug}" is already taken.`,
                };
            }
            throw err;
        }
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
