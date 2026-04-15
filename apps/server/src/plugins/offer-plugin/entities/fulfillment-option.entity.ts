import {
  Channel,
  ChannelAware,
  DeepPartial,
  EntityId,
  ID,
  Seller,
  VendureEntity,
} from "@vendure/core";
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne } from "typeorm";

export type FulfillmentOptionType = "scheduled_pickup" | "scheduled_delivery" | "shipping";
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

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

  @Column({ type: "varchar", default: "scheduled_pickup" })
  type: FulfillmentOptionType;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @Column({ type: "varchar", nullable: true })
  fulfillmentWeekday: Weekday | null;

  @Column({ type: "int", nullable: true })
  fulfillmentTimeWindowStart: number | null;

  @Column({ type: "int", nullable: true })
  fulfillmentTimeWindowEnd: number | null;

  @Column({ type: "varchar", nullable: true })
  orderDeadlineWeekday: Weekday | null;

  @Column({ type: "int", nullable: true })
  orderDeadlineTime: number | null;

  @Column({ type: "timestamptz", nullable: true })
  deletedAt: Date | null;
}
