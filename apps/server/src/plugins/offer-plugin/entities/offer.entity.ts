import {
    Channel,
    ChannelAware,
    CustomerGroup,
    DeepPartial,
    EntityId,
    ID,
    Seller,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { FulfillmentOption } from './fulfillment-option.entity';
import { OfferLineItem } from './offer-line-item.entity';

@Entity()
export class Offer extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Offer>) {
        super(input);
    }

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @ManyToOne(() => Seller)
    seller: Seller;

    @Index()
    @EntityId()
    sellerId: ID;

    @Column({ type: 'varchar', default: 'draft' })
    status: 'draft' | 'active' | 'paused' | 'expired';

    @Column({ type: 'timestamptz' })
    validFrom: Date;

    @Column({ type: 'timestamptz', nullable: true })
    validUntil: Date | null;

    @ManyToMany(() => CustomerGroup)
    @JoinTable()
    customerGroupFilters: CustomerGroup[];

    @ManyToMany(() => FulfillmentOption)
    @JoinTable()
    fulfillmentOptions: FulfillmentOption[];

    @OneToMany(() => OfferLineItem, item => item.offer)
    lineItems: OfferLineItem[];

    @Column({ default: true })
    allowLateOrders: boolean;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'text', nullable: true })
    internalNotes: string | null;
}
