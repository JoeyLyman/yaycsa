import { DeepPartial, EntityId, ID, ProductVariant, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import type { CasePriceTier, TieredPriceTier } from '../types';
import { Offer } from './offer.entity';

@Entity()
export class OfferLineItem extends VendureEntity {
    constructor(input?: DeepPartial<OfferLineItem>) {
        super(input);
    }

    @ManyToOne(() => Offer, offer => offer.lineItems, { onDelete: 'CASCADE' })
    @JoinColumn()
    offer: Offer;

    @Index()
    @EntityId()
    offerId: ID;

    @ManyToOne(() => ProductVariant)
    productVariant: ProductVariant;

    @Index()
    @EntityId()
    productVariantId: ID;

    @Column({ type: 'int' })
    price: number;

    @Column({ default: false })
    priceIncludesTax: boolean;

    @Column({ type: 'varchar', default: 'tiered' })
    pricingMode: 'tiered' | 'case';

    @Column({ type: 'jsonb', nullable: true })
    priceTiers: TieredPriceTier[] | CasePriceTier[] | null;

    @Column({ type: 'varchar', default: 'unlimited' })
    quantityLimitMode: 'unlimited' | 'offer_specific' | 'inventory_linked';

    @Column({ type: 'int', nullable: true })
    quantityLimit: number | null;

    @Column({ default: false })
    autoConfirm: boolean;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;
}
