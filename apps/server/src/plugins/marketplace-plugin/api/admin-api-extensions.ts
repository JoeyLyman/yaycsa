import gql from 'graphql-tag';

export const adminApiExtensions = gql`
    extend type Mutation {
        """
        Replace a product's facet values atomically, bypassing the TypeORM
        duplicate-key bug in Vendure's built-in updateProduct mutation.
        Uses TypeORM's relation query builder (addAndRemove) to directly
        manipulate the join table without going through save().
        """
        syncProductFacetValues(productId: ID!, facetValueIds: [ID!]!): Boolean!
    }
`;
