import { LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { OfferPriceCalculationStrategy } from './strategies/offer-price-calculation.strategy';
import { OfferOrderSellerStrategy } from './strategies/offer-seller.strategy';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { OfferAdminResolver } from './api/offer-admin.resolver';
import { OfferLineItemEntityResolver } from './api/offer-entity.resolver';
import { OfferShopResolver } from './api/offer-shop.resolver';
import { FulfillmentOption } from './entities/fulfillment-option.entity';
import { Offer } from './entities/offer.entity';
import { OfferLineItem } from './entities/offer-line-item.entity';
import { FulfillmentOptionService } from './services/fulfillment-option.service';
import { OfferService } from './services/offer.service';
import './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [FulfillmentOption, Offer, OfferLineItem],
    providers: [FulfillmentOptionService, OfferService],
    compatibility: '^3.0.0',
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [OfferAdminResolver, OfferLineItemEntityResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [OfferShopResolver, OfferLineItemEntityResolver],
    },
    configuration: config => {
        // --- ProductVariant: unitType ---
        config.customFields.ProductVariant.push({
            name: 'unitType',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.en, value: 'Unit Type' }],
            description: [{ languageCode: LanguageCode.en, value: 'Standardized unit for cross-seller aggregation' }],
            options: [
                { value: 'ct', label: [{ languageCode: LanguageCode.en, value: 'Count (each)' }] },
                { value: 'lb', label: [{ languageCode: LanguageCode.en, value: 'Pound (lb)' }] },
                { value: 'oz', label: [{ languageCode: LanguageCode.en, value: 'Ounce (oz)' }] },
                { value: 'kg', label: [{ languageCode: LanguageCode.en, value: 'Kilogram (kg)' }] },
                { value: 'g', label: [{ languageCode: LanguageCode.en, value: 'Gram (g)' }] },
                { value: 'pt', label: [{ languageCode: LanguageCode.en, value: 'Pint (pt)' }] },
                { value: 'qt', label: [{ languageCode: LanguageCode.en, value: 'Quart (qt)' }] },
                { value: 'gal', label: [{ languageCode: LanguageCode.en, value: 'Gallon (gal)' }] },
                { value: 'cs', label: [{ languageCode: LanguageCode.en, value: 'Case (cs)' }] },
                { value: 'bu', label: [{ languageCode: LanguageCode.en, value: 'Bunch (bu)' }] },
            ],
        });

        // --- Customer: notes ---
        config.customFields.Customer.push({
            name: 'notes',
            type: 'text',
            nullable: true,
            label: [{ languageCode: LanguageCode.en, value: 'Notes' }],
            description: [{ languageCode: LanguageCode.en, value: 'Global notes about this customer' }],
        });

        // --- Seller: timezone ---
        config.customFields.Seller.push({
            name: 'timezone',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.en, value: 'Timezone' }],
            description: [{ languageCode: LanguageCode.en, value: 'IANA timezone (e.g. America/Los_Angeles). Optional — UTC assumed if not set.' }],
        });

        // --- Seller: slug ---
        config.customFields.Seller.push({
            name: 'slug',
            type: 'string',
            unique: true,
            nullable: true,
            label: [{ languageCode: LanguageCode.en, value: 'URL Slug' }],
            description: [{ languageCode: LanguageCode.en, value: 'URL-friendly identifier for the seller (e.g. gathering-together-farm)' }],
        });

        // --- CustomerGroup: sellerId ---
        config.customFields.CustomerGroup.push({
            name: 'sellerId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.en, value: 'Seller ID' }],
            description: [{ languageCode: LanguageCode.en, value: 'Scopes this group to a specific seller. Null = global group.' }],
        });

        // --- Order: offer, fulfillmentOption ---
        config.customFields.Order.push(
            {
                name: 'offer',
                type: 'relation',
                entity: Offer,
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Offer' }],
                graphQLType: 'Offer',
                public: false,
            },
            {
                name: 'fulfillmentOption',
                type: 'relation',
                entity: FulfillmentOption,
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Fulfillment Option' }],
                graphQLType: 'FulfillmentOption',
                public: false,
            },
        );

        // --- OrderLine: offerLineItem, lineStatus, selectedCaseQuantity, agreedUnitPrice, buyerNotes ---
        config.customFields.OrderLine.push(
            {
                name: 'offerLineItem',
                type: 'relation',
                entity: OfferLineItem,
                nullable: true,
                eager: true,
                label: [{ languageCode: LanguageCode.en, value: 'Offer Line Item' }],
                graphQLType: 'OfferLineItem',
                public: false,
            },
            {
                name: 'lineStatus',
                type: 'string',
                nullable: false,
                defaultValue: 'pending',
                label: [{ languageCode: LanguageCode.en, value: 'Line Status' }],
                options: [
                    { value: 'pending', label: [{ languageCode: LanguageCode.en, value: 'Pending' }] },
                    { value: 'confirmed', label: [{ languageCode: LanguageCode.en, value: 'Confirmed' }] },
                    { value: 'adjusted', label: [{ languageCode: LanguageCode.en, value: 'Adjusted' }] },
                    { value: 'cancelled', label: [{ languageCode: LanguageCode.en, value: 'Cancelled' }] },
                ],
            },
            {
                name: 'selectedCaseQuantity',
                type: 'int',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Selected Case Quantity' }],
                description: [{ languageCode: LanguageCode.en, value: 'For case pricing: which case size was selected' }],
                public: false,
            },
            {
                name: 'agreedUnitPrice',
                type: 'int',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Agreed Unit Price' }],
                description: [{ languageCode: LanguageCode.en, value: 'Snapshot of unit price (cents) at order placement' }],
                public: false,
            },
            {
                name: 'buyerNotes',
                type: 'text',
                nullable: true,
                label: [{ languageCode: LanguageCode.en, value: 'Buyer Notes' }],
                description: [{ languageCode: LanguageCode.en, value: 'Buyer per-line note for the seller' }],
            },
        );

        // --- Pricing strategy: use offer-based prices ---
        config.orderOptions.orderItemPriceCalculationStrategy =
            new OfferPriceCalculationStrategy();

        // --- Seller strategy: multi-vendor order splitting ---
        config.orderOptions.orderSellerStrategy =
            new OfferOrderSellerStrategy();

        return config;
    },
})
export class OfferPlugin {}
