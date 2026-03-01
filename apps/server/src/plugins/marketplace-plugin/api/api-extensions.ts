import gql from 'graphql-tag';

export const shopApiExtensions = gql`
    type ShopSeller {
        id: ID!
        name: String!
        slug: String
    }

    extend type Query {
        sellers(activeOffersOnly: Boolean): [ShopSeller!]!
        sellerBySlug(slug: String!): ShopSeller
    }
`;
