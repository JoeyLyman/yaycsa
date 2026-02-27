import { graphql } from '../../../graphql.js';

export const ActiveCustomerFields = graphql(`
	fragment ActiveCustomerFields on Customer {
		id
		firstName
		lastName
		emailAddress
	}
`);

export const FulfillmentOptionFields = graphql(`
	fragment FulfillmentOptionFields on FulfillmentOption {
		id
		code
		name
		type
		description
		active
		sortOrder
		recurrence
		fulfillmentStartDate
		fulfillmentEndDate
		fulfillmentTimeDescription
		deadlineOffsetHours
	}
`);

export const OfferLineItemFields = graphql(`
	fragment OfferLineItemFields on OfferLineItem {
		id
		productVariant {
			id
			name
			sku
			customFields {
				unitType
			}
		}
		price
		priceIncludesTax
		pricingMode
		priceTiers
		quantityLimitMode
		quantityLimit
		quantityOrdered
		quantityRemaining
		autoConfirm
		notes
		sortOrder
	}
`);

export const OfferFields = graphql(
	`
		fragment OfferFields on Offer {
			id
			createdAt
			updatedAt
			seller {
				id
				name
			}
			status
			validFrom
			validUntil
			allowLateOrders
			notes
			fulfillmentOptions {
				...FulfillmentOptionFields
			}
			lineItems {
				...OfferLineItemFields
			}
		}
	`,
	[FulfillmentOptionFields, OfferLineItemFields]
);
