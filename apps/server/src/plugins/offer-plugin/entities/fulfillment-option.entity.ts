import { Channel, ChannelAware, DeepPartial, EntityId, ID, Seller, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne } from 'typeorm';

@Entity()
export class FulfillmentOption extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<FulfillmentOption>) {
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

    @Column()
    code: string;

    @Column()
    name: string;

    @Column({ type: 'varchar', default: 'pickup' })
    type: 'pickup' | 'delivery';

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ default: true })
    active: boolean;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    @Column({ type: 'varchar', nullable: true })
    recurrence:
        | 'once'
        | 'daily'
        | 'weekly'
        | 'every_2_weeks'
        | 'every_4_weeks'
        | 'every_8_weeks'
        | 'every_12_weeks'
        | null;

    @Column({ type: 'timestamptz', nullable: true })
    fulfillmentStartDate: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    fulfillmentEndDate: Date | null;

    @Column({ type: 'text', nullable: true })
    fulfillmentTimeDescription: string | null;

    @Column({ type: 'int', nullable: true })
    deadlineOffsetHours: number | null;
}
