/**
 * Fulfillment option and business-timezone remote functions for sellers.
 *
 * All operations use the Admin API proxy in the default channel.
 * Seller identity comes from the authenticated shop session, and ownership is
 * enforced with sellerId-based checks before every mutation.
 *
 * IMPORTANT: We do NOT scope these requests with `vendure-token` because the
 * superadmin proxy is only authorized in the default channel. Instead, the
 * custom Offer plugin accepts an explicit sellerId override so the proxy can
 * create, list, update, delete, and restore the current seller's fulfillment
 * options while staying in the default channel.
 */

import * as v from 'valibot';
import { command, query } from '$app/server';
import { adminMutate, adminQuery } from '../vendure-admin.js';
import { assertFulfillmentOptionOwnedBySeller, requireSellerContext } from '../seller-context.js';

export type FulfillmentOptionType =
	| 'scheduled_pickup'
	| 'scheduled_delivery'
	| 'shipping';
export type Weekday =
	| 'monday'
	| 'tuesday'
	| 'wednesday'
	| 'thursday'
	| 'friday'
	| 'saturday'
	| 'sunday';

/** Simplified fulfillment-option type returned to the UI. */
export interface SellerFulfillmentOption {
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

const FULFILLMENT_OPTIONS_QUERY = `
	query FulfillmentOptions($sellerId: ID!, $includeDeleted: Boolean) {
		fulfillmentOptions(sellerId: $sellerId, includeDeleted: $includeDeleted, options: { take: 500 }) {
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

const CREATE_FULFILLMENT_OPTION_MUTATION = `
	mutation CreateFulfillmentOption($sellerId: ID!, $input: CreateFulfillmentOptionInput!) {
		createFulfillmentOption(sellerId: $sellerId, input: $input) {
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
`;

const UPDATE_FULFILLMENT_OPTION_MUTATION = `
	mutation UpdateFulfillmentOption($sellerId: ID!, $input: UpdateFulfillmentOptionInput!) {
		updateFulfillmentOption(sellerId: $sellerId, input: $input) {
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
`;

const DELETE_FULFILLMENT_OPTION_MUTATION = `
	mutation DeleteFulfillmentOption($sellerId: ID!, $id: ID!, $permanently: Boolean) {
		deleteFulfillmentOption(sellerId: $sellerId, id: $id, permanently: $permanently) {
			result
			message
		}
	}
`;

const RESTORE_FULFILLMENT_OPTION_MUTATION = `
	mutation RestoreFulfillmentOption($sellerId: ID!, $id: ID!) {
		restoreFulfillmentOption(sellerId: $sellerId, id: $id) {
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
`;

const UPDATE_BUSINESS_TIMEZONE_MUTATION = `
	mutation UpdateBusinessTimezone($input: UpdateSellerInput!) {
		updateSeller(input: $input) {
			id
			customFields {
				timezone
			}
		}
	}
`;

interface AdminFulfillmentOption {
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

function toSellerFulfillmentOption(option: AdminFulfillmentOption): SellerFulfillmentOption {
	return {
		id: option.id,
		name: option.name,
		type: option.type,
		notes: option.notes,
		fulfillmentWeekday: option.fulfillmentWeekday,
		fulfillmentTimeWindowStart: option.fulfillmentTimeWindowStart,
		fulfillmentTimeWindowEnd: option.fulfillmentTimeWindowEnd,
		orderDeadlineWeekday: option.orderDeadlineWeekday,
		orderDeadlineTime: option.orderDeadlineTime,
		deletedAt: option.deletedAt
	};
}

function sortFulfillmentOptions(options: SellerFulfillmentOption[]): SellerFulfillmentOption[] {
	return [...options].sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeOptionalText(value?: string | null): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalInteger(value?: number | null): number | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	return Number.isFinite(value) ? Math.trunc(value) : null;
}

function isValidIanaTimezone(value: string): boolean {
	try {
		Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
		return true;
	} catch {
		return false;
	}
}

function normalizeBusinessTimezone(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}
	if (!isValidIanaTimezone(trimmed)) {
		throw new Error('Enter a valid IANA timezone like America/Los_Angeles');
	}
	return trimmed;
}

const weekdayValues = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday'
] as const;

const fulfillmentOptionInputSchema = v.object({
	name: v.pipe(
		v.string(),
		v.nonEmpty('Fulfillment option name is required'),
		v.minLength(2, 'Name must be at least 2 characters'),
		v.maxLength(120)
	),
	type: v.picklist(['scheduled_pickup', 'scheduled_delivery', 'shipping']),
	notes: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(1000)))),
	fulfillmentWeekday: v.optional(v.nullable(v.picklist(weekdayValues))),
	fulfillmentTimeWindowStart: v.optional(v.nullable(v.number())),
	fulfillmentTimeWindowEnd: v.optional(v.nullable(v.number())),
	orderDeadlineWeekday: v.optional(v.nullable(v.picklist(weekdayValues))),
	orderDeadlineTime: v.optional(v.nullable(v.number()))
});

/** Fetch all fulfillment options owned by the current seller. */
export const myFulfillmentOptions = query(
	v.optional(v.object({ includeDeleted: v.optional(v.boolean()) })),
	async (args): Promise<SellerFulfillmentOption[]> => {
		const { sellerId } = await requireSellerContext();
		const data = await adminQuery<{
			fulfillmentOptions: { items: AdminFulfillmentOption[] };
		}>(FULFILLMENT_OPTIONS_QUERY, {
			sellerId,
			includeDeleted: args?.includeDeleted ?? false
		});

		return sortFulfillmentOptions(data.fulfillmentOptions.items.map(toSellerFulfillmentOption));
	}
);

/** Create a fulfillment option for the current seller. */
export const createFulfillmentOption = command(
	fulfillmentOptionInputSchema,
	async (input): Promise<SellerFulfillmentOption> => {
		const { sellerId } = await requireSellerContext();

		const data = await adminMutate<{
			createFulfillmentOption: AdminFulfillmentOption;
		}>(CREATE_FULFILLMENT_OPTION_MUTATION, {
			sellerId,
			input: {
				name: input.name.trim(),
				type: input.type,
				notes: normalizeOptionalText(input.notes),
				fulfillmentWeekday: input.fulfillmentWeekday ?? null,
				fulfillmentTimeWindowStart: normalizeOptionalInteger(input.fulfillmentTimeWindowStart),
				fulfillmentTimeWindowEnd: normalizeOptionalInteger(input.fulfillmentTimeWindowEnd),
				orderDeadlineWeekday: input.orderDeadlineWeekday ?? null,
				orderDeadlineTime: normalizeOptionalInteger(input.orderDeadlineTime)
			}
		});

		return toSellerFulfillmentOption(data.createFulfillmentOption);
	}
);

/** Update a fulfillment option owned by the current seller. */
export const updateFulfillmentOption = command(
	v.object({
		id: v.string(),
		...fulfillmentOptionInputSchema.entries
	}),
	async (input): Promise<SellerFulfillmentOption> => {
		const { sellerId } = await requireSellerContext();
		await assertFulfillmentOptionOwnedBySeller(input.id, sellerId);

		const data = await adminMutate<{
			updateFulfillmentOption: AdminFulfillmentOption;
		}>(UPDATE_FULFILLMENT_OPTION_MUTATION, {
			sellerId,
			input: {
				id: input.id,
				name: input.name.trim(),
				type: input.type,
				notes: normalizeOptionalText(input.notes),
				fulfillmentWeekday: input.fulfillmentWeekday ?? null,
				fulfillmentTimeWindowStart: normalizeOptionalInteger(input.fulfillmentTimeWindowStart),
				fulfillmentTimeWindowEnd: normalizeOptionalInteger(input.fulfillmentTimeWindowEnd),
				orderDeadlineWeekday: input.orderDeadlineWeekday ?? null,
				orderDeadlineTime: normalizeOptionalInteger(input.orderDeadlineTime)
			}
		});

		return toSellerFulfillmentOption(data.updateFulfillmentOption);
	}
);

/** Delete or permanently delete a fulfillment option owned by the current seller. */
export const deleteFulfillmentOption = command(
	v.object({
		id: v.string(),
		permanently: v.optional(v.boolean())
	}),
	async ({ id, permanently }) => {
		const { sellerId } = await requireSellerContext();
		await assertFulfillmentOptionOwnedBySeller(id, sellerId);

		const data = await adminMutate<{
			deleteFulfillmentOption: { result: string; message?: string | null };
		}>(DELETE_FULFILLMENT_OPTION_MUTATION, { sellerId, id, permanently: permanently ?? false });

		if (data.deleteFulfillmentOption.result !== 'DELETED') {
			throw new Error(
				data.deleteFulfillmentOption.message || 'Failed to delete fulfillment option'
			);
		}

		return { success: true as const };
	}
);

/** Restore a soft-deleted fulfillment option owned by the current seller. */
export const restoreFulfillmentOption = command(
	v.string(),
	async (id): Promise<SellerFulfillmentOption> => {
		const { sellerId } = await requireSellerContext();
		await assertFulfillmentOptionOwnedBySeller(id, sellerId);

		const data = await adminMutate<{
			restoreFulfillmentOption: AdminFulfillmentOption;
		}>(RESTORE_FULFILLMENT_OPTION_MUTATION, { sellerId, id });

		return toSellerFulfillmentOption(data.restoreFulfillmentOption);
	}
);

/** Update the seller business timezone used to interpret fulfillment schedule templates. */
export const updateBusinessTimezone = command(v.string(), async (timezone): Promise<string | null> => {
	const { sellerId } = await requireSellerContext();
	const normalizedTimezone = normalizeBusinessTimezone(timezone);

	const data = await adminMutate<{
		updateSeller: { id: string; customFields: { timezone: string | null } | null };
	}>(UPDATE_BUSINESS_TIMEZONE_MUTATION, {
		input: {
			id: sellerId,
			customFields: {
				timezone: normalizedTimezone
			}
		}
	});

	return data.updateSeller.customFields?.timezone ?? null;
});
