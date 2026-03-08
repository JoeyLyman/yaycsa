import gql from 'graphql-tag';

export const shopApiExtensions = gql`
    type ShopSeller {
        id: ID!
        name: String!
        slug: String
    }

    input BecomeSellerInput {
        shopName: String!
        slug: String!
    }

    type BecomeSellerSuccess {
        seller: ShopSeller!
    }

    type SlugAlreadyTakenError {
        errorCode: String!
        message: String!
    }

    type AlreadyASellerError {
        errorCode: String!
        message: String!
    }

    type InvalidSlugError {
        errorCode: String!
        message: String!
    }

    type SellerRegistrationClosedError {
        errorCode: String!
        message: String!
    }

    union BecomeSellerResult =
          BecomeSellerSuccess
        | SlugAlreadyTakenError
        | InvalidSlugError
        | AlreadyASellerError
        | SellerRegistrationClosedError

    extend type Query {
        sellers(activeOffersOnly: Boolean): [ShopSeller!]!
        sellerBySlug(slug: String!): ShopSeller
    }

    extend type Mutation {
        becomeSeller(input: BecomeSellerInput!): BecomeSellerResult!
    }
`;
