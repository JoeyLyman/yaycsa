import { LanguageCode, PluginCommonModule, Seller, VendurePlugin } from '@vendure/core';

import { shopApiExtensions } from './api/api-extensions';
import { MarketplaceShopResolver } from './api/marketplace-shop.resolver';
import { MarketplaceService } from './services/marketplace.service';

export interface MarketplacePluginOptions {
    /** Whether any authenticated customer can self-service become a seller. Default: true. */
    allowOpenSellerRegistration: boolean;
}

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [MarketplaceService],
    compatibility: '^3.0.0',
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [MarketplaceShopResolver],
    },
    configuration: config => {
        // --- Seller: slug (moved from offer-plugin — seller identity belongs here) ---
        config.customFields.Seller.push({
            name: 'slug',
            type: 'string',
            unique: true,
            nullable: true,
            label: [{ languageCode: LanguageCode.en, value: 'URL Slug' }],
            description: [{ languageCode: LanguageCode.en, value: 'URL-friendly identifier for the seller (e.g. gathering-together-farm)' }],
        });

        // --- Product: sellerId (explicit ownership for proxy authorization checks) ---
        // Products are assigned to both seller channel AND default channel (for marketplace visibility),
        // so channel membership alone doesn't identify the owner. This field is the source of truth.
        config.customFields.Product.push({
            name: 'sellerId',
            type: 'int',
            nullable: true,
            public: false, // Admin API only — not exposed on Shop API
            label: [{ languageCode: LanguageCode.en, value: 'Seller ID' }],
            description: [{ languageCode: LanguageCode.en, value: 'Owner seller ID for proxy authorization checks' }],
        });

        // --- FacetValue: group (food group metadata for bits taxonomy) ---
        // Each bit (ingredient) FacetValue has a group like "Vegetables", "Dairy", etc.
        // Used for browse grouping only, not nutritional truth.
        config.customFields.FacetValue.push({
            name: 'group',
            type: 'string',
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.en, value: 'Food Group' }],
            description: [{ languageCode: LanguageCode.en, value: 'Browse group for ingredient taxonomy (e.g. Vegetables, Dairy, Meat)' }],
        });

        // --- Customer: seller (1:1 link to Seller for unified accounts) ---
        config.customFields.Customer.push({
            name: 'seller',
            type: 'relation',
            entity: Seller,
            nullable: true,
            label: [{ languageCode: LanguageCode.en, value: 'Seller' }],
            description: [{ languageCode: LanguageCode.en, value: 'The seller associated with this customer account (unified accounts)' }],
        });

        return config;
    },
})
export class MarketplacePlugin {
    static options: MarketplacePluginOptions = { allowOpenSellerRegistration: true };

    static init(options?: Partial<MarketplacePluginOptions>) {
        if (options) Object.assign(this.options, options);
        return this;
    }
}
