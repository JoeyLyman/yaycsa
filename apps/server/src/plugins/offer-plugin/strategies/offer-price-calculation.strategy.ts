import {
    Order,
    OrderItemPriceCalculationStrategy,
    PriceCalculationResult,
    ProductVariant,
    RequestContext,
} from '@vendure/core';

import type { OfferLineItem } from '../entities/offer-line-item.entity';
import type { CasePriceTier, TieredPriceTier } from '../types';

/**
 * Custom pricing strategy that reads prices from the OfferLineItem
 * rather than the ProductVariant's standard price.
 *
 * Falls back to the default ProductVariant listPrice if no OfferLineItem
 * is associated with the OrderLine.
 */
export class OfferPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    calculateUnitPrice(
        ctx: RequestContext,
        productVariant: ProductVariant,
        orderLineCustomFields: { [key: string]: any },
        order: Order,
        quantity: number,
    ): PriceCalculationResult {
        const offerLineItem: OfferLineItem | undefined = orderLineCustomFields.offerLineItem;

        // No offer line item → fall back to default ProductVariant pricing
        if (!offerLineItem) {
            return {
                price: productVariant.listPrice,
                priceIncludesTax: productVariant.listPriceIncludesTax,
            };
        }

        const selectedCaseQuantity: number | undefined =
            orderLineCustomFields.selectedCaseQuantity;

        // Case pricing: find matching case tier by selectedCaseQuantity
        if (offerLineItem.pricingMode === 'case' && selectedCaseQuantity && offerLineItem.priceTiers) {
            const tiers = offerLineItem.priceTiers as CasePriceTier[];
            const caseTier = tiers.find(t => t.quantity === selectedCaseQuantity);
            if (caseTier) {
                return {
                    price: Math.round(caseTier.casePrice / caseTier.quantity),
                    priceIncludesTax: offerLineItem.priceIncludesTax,
                };
            }
        }

        // Tiered pricing: find highest tier where minQuantity <= quantity
        if (offerLineItem.pricingMode === 'tiered' && offerLineItem.priceTiers?.length) {
            const tiers = [...(offerLineItem.priceTiers as TieredPriceTier[])]
                .sort((a, b) => b.minQuantity - a.minQuantity);
            const tier = tiers.find(t => t.minQuantity <= quantity);
            if (tier) {
                return {
                    price: tier.unitPrice,
                    priceIncludesTax: offerLineItem.priceIncludesTax,
                };
            }
        }

        // Fallback: base price from offer line item
        return {
            price: offerLineItem.price,
            priceIncludesTax: offerLineItem.priceIncludesTax,
        };
    }
}
