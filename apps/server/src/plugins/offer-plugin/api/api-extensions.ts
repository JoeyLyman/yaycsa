import gql from "graphql-tag";

const commonTypes = gql`
  enum FulfillmentOptionType {
    scheduled_pickup
    scheduled_delivery
    shipping
  }

  enum Weekday {
    monday
    tuesday
    wednesday
    thursday
    friday
    saturday
    sunday
  }

  enum OfferStatus {
    draft
    active
    paused
    expired
  }

  enum PricingMode {
    tiered
    case
  }

  enum QuantityLimitMode {
    unlimited
    offer_specific
    inventory_linked
  }

  type TieredPriceTier {
    minQuantity: Int!
    unitPrice: Int!
  }

  type CasePriceTier {
    quantity: Int!
    casePrice: Int!
    label: String!
  }

  union PriceTier = TieredPriceTier | CasePriceTier

  type FulfillmentOption implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    seller: Seller!
    code: String!
    name: String!
    type: FulfillmentOptionType!
    notes: String
    sortOrder: Int!
    fulfillmentWeekday: Weekday
    fulfillmentTimeWindowStart: Int
    fulfillmentTimeWindowEnd: Int
    orderDeadlineWeekday: Weekday
    orderDeadlineTime: Int
    deletedAt: DateTime
  }

  type OfferLineItem implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    offer: Offer!
    productVariant: ProductVariant!
    price: Int!
    priceIncludesTax: Boolean!
    pricingMode: PricingMode!
    priceTiers: JSON
    quantityLimitMode: QuantityLimitMode!
    quantityLimit: Int
    autoConfirm: Boolean!
    notes: String
    sortOrder: Int!
    quantityOrdered: Int!
    quantityRemaining: Int
  }

  type Offer implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    seller: Seller!
    status: OfferStatus!
    validFrom: DateTime!
    validUntil: DateTime
    customerGroupFilters: [CustomerGroup!]!
    fulfillmentOptions: [FulfillmentOption!]!
    lineItems: [OfferLineItem!]!
    allowLateOrders: Boolean!
    notes: String
    internalNotes: String
  }

  type OfferList implements PaginatedList {
    items: [Offer!]!
    totalItems: Int!
  }

  type FulfillmentOptionList implements PaginatedList {
    items: [FulfillmentOption!]!
    totalItems: Int!
  }
`;

export const adminApiExtensions = gql`
  ${commonTypes}

  input CreateFulfillmentOptionInput {
    name: String!
    type: FulfillmentOptionType!
    notes: String
    fulfillmentWeekday: Weekday
    fulfillmentTimeWindowStart: Int
    fulfillmentTimeWindowEnd: Int
    orderDeadlineWeekday: Weekday
    orderDeadlineTime: Int
  }

  input UpdateFulfillmentOptionInput {
    id: ID!
    name: String
    type: FulfillmentOptionType
    notes: String
    fulfillmentWeekday: Weekday
    fulfillmentTimeWindowStart: Int
    fulfillmentTimeWindowEnd: Int
    orderDeadlineWeekday: Weekday
    orderDeadlineTime: Int
  }

  input CreateOfferLineItemInput {
    productVariantId: ID!
    price: Int!
    priceIncludesTax: Boolean
    pricingMode: PricingMode
    priceTiers: JSON
    quantityLimitMode: QuantityLimitMode
    quantityLimit: Int
    autoConfirm: Boolean
    notes: String
    sortOrder: Int
  }

  input UpdateOfferLineItemInput {
    id: ID!
    price: Int
    priceIncludesTax: Boolean
    pricingMode: PricingMode
    priceTiers: JSON
    quantityLimitMode: QuantityLimitMode
    quantityLimit: Int
    autoConfirm: Boolean
    notes: String
    sortOrder: Int
  }

  input CreateOfferInput {
    validFrom: DateTime!
    validUntil: DateTime
    customerGroupFilterIds: [ID!]
    fulfillmentOptionIds: [ID!]!
    lineItems: [CreateOfferLineItemInput!]!
    allowLateOrders: Boolean
    notes: String
    internalNotes: String
  }

  input UpdateOfferInput {
    id: ID!
    validFrom: DateTime
    validUntil: DateTime
    customerGroupFilterIds: [ID!]
    fulfillmentOptionIds: [ID!]
    allowLateOrders: Boolean
    notes: String
    internalNotes: String
    addLineItems: [CreateOfferLineItemInput!]
    updateLineItems: [UpdateOfferLineItemInput!]
    removeLineItemIds: [ID!]
  }

  extend type Query {
    offers(options: OfferListOptions, sellerId: ID): OfferList!
    offer(id: ID!, sellerId: ID): Offer
    offerPrefill: Offer
    fulfillmentOptions(
      options: FulfillmentOptionListOptions
      sellerId: ID
      includeDeleted: Boolean
    ): FulfillmentOptionList!
    fulfillmentOption(id: ID!, sellerId: ID, includeDeleted: Boolean): FulfillmentOption
  }

  extend type Mutation {
    createFulfillmentOption(input: CreateFulfillmentOptionInput!, sellerId: ID): FulfillmentOption!
    updateFulfillmentOption(input: UpdateFulfillmentOptionInput!, sellerId: ID): FulfillmentOption!
    deleteFulfillmentOption(id: ID!, sellerId: ID, permanently: Boolean): DeletionResponse!
    restoreFulfillmentOption(id: ID!, sellerId: ID): FulfillmentOption!
    createOffer(input: CreateOfferInput!): Offer!
    updateOffer(input: UpdateOfferInput!): Offer!
    activateOffer(id: ID!): Offer!
    pauseOffer(id: ID!): Offer!
    expireOffer(id: ID!): Offer!
  }

  # These allow Vendure's ListQueryBuilder to auto-generate filter/sort options
  input OfferListOptions
  input FulfillmentOptionListOptions
`;

export const shopApiExtensions = gql`
  ${commonTypes}

  extend type Query {
    activeOffers(sellerId: ID): [Offer!]!
    offerLineItem(id: ID!): OfferLineItem
  }

  extend type Mutation {
    addOfferItemToOrder(offerLineItemId: ID!, quantity: Int!, selectedCaseQuantity: Int, buyerNotes: String): Order!
    adjustOfferItemQuantity(orderLineId: ID!, quantity: Int!): Order!
  }
`;
