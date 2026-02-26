import gql from 'graphql-tag';

const commonTypes = gql`
    enum FulfillmentOptionType {
        pickup
        delivery
    }

    enum RecurrenceType {
        once
        daily
        weekly
        every_2_weeks
        every_4_weeks
        every_8_weeks
        every_12_weeks
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
        description: String
        active: Boolean!
        sortOrder: Int!
        recurrence: RecurrenceType
        fulfillmentStartDate: DateTime
        fulfillmentEndDate: DateTime
        fulfillmentTimeDescription: String
        deadlineOffsetHours: Int
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
        code: String!
        name: String!
        type: FulfillmentOptionType!
        description: String
        active: Boolean
        sortOrder: Int
        recurrence: RecurrenceType
        fulfillmentStartDate: DateTime
        fulfillmentEndDate: DateTime
        fulfillmentTimeDescription: String
        deadlineOffsetHours: Int
    }

    input UpdateFulfillmentOptionInput {
        id: ID!
        code: String
        name: String
        type: FulfillmentOptionType
        description: String
        active: Boolean
        sortOrder: Int
        recurrence: RecurrenceType
        fulfillmentStartDate: DateTime
        fulfillmentEndDate: DateTime
        fulfillmentTimeDescription: String
        deadlineOffsetHours: Int
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
        offers(options: OfferListOptions): OfferList!
        offer(id: ID!): Offer
        offerPrefill: Offer
        fulfillmentOptions(options: FulfillmentOptionListOptions): FulfillmentOptionList!
        fulfillmentOption(id: ID!): FulfillmentOption
    }

    extend type Mutation {
        createFulfillmentOption(input: CreateFulfillmentOptionInput!): FulfillmentOption!
        updateFulfillmentOption(input: UpdateFulfillmentOptionInput!): FulfillmentOption!
        deleteFulfillmentOption(id: ID!): DeletionResponse!
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
        addOfferItemToOrder(
            offerLineItemId: ID!
            quantity: Int!
            selectedCaseQuantity: Int
            buyerNotes: String
        ): Order!
        adjustOfferItemQuantity(orderLineId: ID!, quantity: Int!): Order!
    }
`;
