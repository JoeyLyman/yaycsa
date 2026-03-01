import { LanguageCode, PluginCommonModule, Seller, VendurePlugin } from '@vendure/core';

import { shopApiExtensions } from './api/api-extensions';
import { MarketplaceShopResolver } from './api/marketplace-shop.resolver';
import { MarketplaceService } from './services/marketplace.service';

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
export class MarketplacePlugin {}
