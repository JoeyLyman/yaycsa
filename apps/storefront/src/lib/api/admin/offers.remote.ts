/**
 * Seller offers workspace query helpers.
 *
 * These remote queries power the `/me/offers` workspace summary strip and the
 * fulfillment-option usage counts. They run through the server-side Admin API
 * proxy in the default channel and scope the data by the authenticated seller.
 */

import { query } from '$app/server';
import { adminQuery } from '../vendure-admin.js';
import { requireSellerContext } from '../seller-context.js';
import type {
	FulfillmentOptionType,
	SellerFulfillmentOption,
	Weekday
} from './fulfillment-options.remote.js';

export type OfferStatus = 'draft' | 'active' | 'paused' | 'expired';

/** Minimal seller-offer shape used by the workspace shell. */
export interface SellerOfferWorkspaceItem {
	id: string;
	status: OfferStatus;
	validFrom: string;
	validUntil: string | null;
	fulfillmentOptionIds: string[];
	fulfillmentOptionNames: string[];
	lineItemCount: number;
}

/** Fulfillment option enriched with offer-usage counts for the workspace table. */
export interface SellerFulfillmentOptionWorkspaceItem extends SellerFulfillmentOption {
	activeOfferCount: number;
	offerCount: number;
	historicalOfferCount: number;
	canPermanentlyDelete: boolean;
}

/** Summary and row data returned to the `/me/offers` workspace. */
export interface SellerOffersWorkspaceData {
	businessName: string;
	businessTimezone: string | null;
	activeOfferCount: number;
	offerCount: number;
	activeFulfillmentOptionCount: number;
	fulfillmentOptionCount: number;
	offers: SellerOfferWorkspaceItem[];
	currentFulfillmentOptions: SellerFulfillmentOptionWorkspaceItem[];
	deletedFulfillmentOptions: SellerFulfillmentOptionWorkspaceItem[];
}

interface AdminWorkspaceOffer {
	id: string;
	status: OfferStatus;
	validFrom: string;
	validUntil: string | null;
	fulfillmentOptions: Array<{ id: string; name: string }>;
	lineItems: Array<{ id: string }>;
}

interface AdminWorkspaceFulfillmentOption {
	id: string;
	name: string;
	type: FulfillmentOptionType;
	notes: string | null;
	fulfillmentWeekday: Weekday | null;
	fulfillmentTimeWindowStart: number | null;
	fulfillmentTimeWindowEnd: number | null;
	orderDeadlineWeekday: Weekday | null;
	orderDeadlineTime: number | null;
	deletedAt: string | null;
}

const OFFERS_WORKSPACE_QUERY = `
	query OffersWorkspace($sellerId: ID!, $includeDeletedFulfillmentOptions: Boolean) {
		offers(sellerId: $sellerId, options: { take: 500 }) {
			items {
				id
				status
				validFrom
				validUntil
				fulfillmentOptions {
					id
					name
				}
				lineItems {
					id
				}
			}
		}
		fulfillmentOptions(
			sellerId: $sellerId
			includeDeleted: $includeDeletedFulfillmentOptions
			options: { take: 500 }
		) {
			items {
				id
				name
				type
				notes
				fulfillmentWeekday
				fulfillmentTimeWindowStart
				fulfillmentTimeWindowEnd
				orderDeadlineWeekday
				orderDeadlineTime
				deletedAt
			}
		}
	}
`;

function sortOffers(offers: SellerOfferWorkspaceItem[]): SellerOfferWorkspaceItem[] {
	return [...offers].sort((left, right) => {
		if (left.status !== right.status) {
			const statusOrder: OfferStatus[] = ['active', 'draft', 'paused', 'expired'];
			return statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
		}
		return right.validFrom.localeCompare(left.validFrom);
	});
}

function sortFulfillmentOptions(
	fulfillmentOptions: SellerFulfillmentOptionWorkspaceItem[]
): SellerFulfillmentOptionWorkspaceItem[] {
	return [...fulfillmentOptions].sort((left, right) => left.name.localeCompare(right.name));
}

/** Fetch the seller's offers-workspace summary and fulfillment-option usage data. */
export const myOffersWorkspace = query(async (): Promise<SellerOffersWorkspaceData> => {
	const { sellerId, sellerName, sellerTimezone } = await requireSellerContext();
	const data = await adminQuery<{
		offers: { items: AdminWorkspaceOffer[] };
		fulfillmentOptions: { items: AdminWorkspaceFulfillmentOption[] };
	}>(OFFERS_WORKSPACE_QUERY, {
		sellerId,
		includeDeletedFulfillmentOptions: true
	});

	const offers = sortOffers(
		data.offers.items.map((offer) => ({
			id: offer.id,
			status: offer.status,
			validFrom: offer.validFrom,
			validUntil: offer.validUntil,
			fulfillmentOptionIds: offer.fulfillmentOptions.map(
				(fulfillmentOption) => fulfillmentOption.id
			),
			fulfillmentOptionNames: offer.fulfillmentOptions.map(
				(fulfillmentOption) => fulfillmentOption.name
			),
			lineItemCount: offer.lineItems.length
		}))
	);

	const allFulfillmentOptions = data.fulfillmentOptions.items.map((fulfillmentOption) => {
		const offerCount = offers.filter((offer) =>
			offer.fulfillmentOptionIds.includes(fulfillmentOption.id)
		).length;
		const activeOfferCount = offers.filter(
			(offer) =>
				offer.status === 'active' && offer.fulfillmentOptionIds.includes(fulfillmentOption.id)
		).length;

		const workspaceItem: SellerFulfillmentOptionWorkspaceItem = {
			id: fulfillmentOption.id,
			name: fulfillmentOption.name,
			type: fulfillmentOption.type,
			notes: fulfillmentOption.notes,
			fulfillmentWeekday: fulfillmentOption.fulfillmentWeekday,
			fulfillmentTimeWindowStart: fulfillmentOption.fulfillmentTimeWindowStart,
			fulfillmentTimeWindowEnd: fulfillmentOption.fulfillmentTimeWindowEnd,
			orderDeadlineWeekday: fulfillmentOption.orderDeadlineWeekday,
			orderDeadlineTime: fulfillmentOption.orderDeadlineTime,
			deletedAt: fulfillmentOption.deletedAt,
			activeOfferCount,
			offerCount,
			historicalOfferCount: Math.max(offerCount - activeOfferCount, 0),
			canPermanentlyDelete: offerCount === 0
		};

		return workspaceItem;
	});

	const currentFulfillmentOptions = sortFulfillmentOptions(
		allFulfillmentOptions.filter((fulfillmentOption) => fulfillmentOption.deletedAt == null)
	);
	const deletedFulfillmentOptions = sortFulfillmentOptions(
		allFulfillmentOptions.filter((fulfillmentOption) => fulfillmentOption.deletedAt != null)
	);

	return {
		businessName: sellerName,
		businessTimezone: sellerTimezone,
		activeOfferCount: offers.filter((offer) => offer.status === 'active').length,
		offerCount: offers.length,
		activeFulfillmentOptionCount: currentFulfillmentOptions.filter(
			(fulfillmentOption) => fulfillmentOption.activeOfferCount > 0
		).length,
		fulfillmentOptionCount: currentFulfillmentOptions.length,
		offers,
		currentFulfillmentOptions,
		deletedFulfillmentOptions
	};
});
