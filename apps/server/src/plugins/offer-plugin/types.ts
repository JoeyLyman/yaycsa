import type { FulfillmentOption } from './entities/fulfillment-option.entity';
import type { Offer } from './entities/offer.entity';
import type { OfferLineItem } from './entities/offer-line-item.entity';

// --- Price tier interfaces ---

export interface TieredPriceTier {
    minQuantity: number;
    unitPrice: number;
}

export interface CasePriceTier {
    quantity: number;
    casePrice: number;
    label: string;
}

// --- Custom field type declarations for built-in entities ---

declare module '@vendure/core/dist/entity/custom-entity-fields' {
    interface CustomProductVariantFields {
        unitType: string | null;
    }
    interface CustomCustomerFields {
        notes: string | null;
    }
    interface CustomSellerFields {
        timezone: string | null;
    }
    interface CustomCustomerGroupFields {
        sellerId: string | null;
    }
    interface CustomOrderFields {
        offer: Offer | null;
        fulfillmentOption: FulfillmentOption | null;
    }
    interface CustomOrderLineFields {
        offerLineItem: OfferLineItem | null;
        lineStatus: string;
        selectedCaseQuantity: number | null;
        agreedUnitPrice: number | null;
        buyerNotes: string | null;
    }
}
