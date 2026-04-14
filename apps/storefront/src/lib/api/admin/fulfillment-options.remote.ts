/**
 * Fulfillment option management remote functions for sellers.
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

export type FulfillmentOptionType = 'pickup' | 'delivery';
export type RecurrenceType =
	| 'once'
	| 'daily'
	| 'weekly'
	| 'every_2_weeks'
	| 'every_4_weeks'
	| 'every_8_weeks'
	| 'every_12_weeks';

/** Simplified fulfillment-option type returned to the UI. */
export interface SellerFulfillmentOption {
	id: string;
	name: string;
	type: FulfillmentOptionType;
	notes: string | null;
	recurrence: RecurrenceType | null;
	fulfillmentStartDate: string | null;
	fulfillmentEndDate: string | null;
	deadlineOffsetHours: number | null;
	deletedAt: string | null;
}

const FULFILLMENT_OPTIONS_QUERY = `
	query FulfillmentOptions($sellerId: ID!, $includeDeleted: Boolean) {
		fulfillmentOptions(sellerId: $sellerId, includeDeleted: $includeDeleted, options: { take: 500 }) {
			items {
				id
				name
				type
				description
				recurrence
				fulfillmentStartDate
				fulfillmentEndDate
				deadlineOffsetHours
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
			description
			recurrence
			fulfillmentStartDate
			fulfillmentEndDate
			deadlineOffsetHours
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
			description
			recurrence
			fulfillmentStartDate
			fulfillmentEndDate
			deadlineOffsetHours
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
			description
			recurrence
			fulfillmentStartDate
			fulfillmentEndDate
			deadlineOffsetHours
			deletedAt
		}
	}
`;

interface AdminFulfillmentOption {
	id: string;
	name: string;
	type: FulfillmentOptionType;
	description: string | null;
	recurrence: RecurrenceType | null;
	fulfillmentStartDate: string | null;
	fulfillmentEndDate: string | null;
	deadlineOffsetHours: number | null;
	deletedAt: string | null;
}

function toSellerFulfillmentOption(option: AdminFulfillmentOption): SellerFulfillmentOption {
	return {
		id: option.id,
		name: option.name,
		type: option.type,
		notes: option.description,
		recurrence: option.recurrence,
		fulfillmentStartDate: option.fulfillmentStartDate,
		fulfillmentEndDate: option.fulfillmentEndDate,
		deadlineOffsetHours: option.deadlineOffsetHours,
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

function normalizeOptionalDateTime(value?: string | null): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;

	const parsedTime = Date.parse(trimmed);
	if (Number.isNaN(parsedTime)) {
		throw new Error('Invalid fulfillment date/time');
	}

	return new Date(parsedTime).toISOString();
}

const recurrenceValues = [
	'once',
	'daily',
	'weekly',
	'every_2_weeks',
	'every_4_weeks',
	'every_8_weeks',
	'every_12_weeks'
] as const;

const fulfillmentOptionInputSchema = v.object({
	name: v.pipe(
		v.string(),
		v.nonEmpty('Fulfillment option name is required'),
		v.minLength(2, 'Name must be at least 2 characters'),
		v.maxLength(120)
	),
	type: v.picklist(['pickup', 'delivery']),
	notes: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(1000)))),
	recurrence: v.optional(v.nullable(v.picklist(recurrenceValues))),
	fulfillmentStartDate: v.optional(v.nullable(v.string())),
	fulfillmentEndDate: v.optional(v.nullable(v.string())),
	deadlineOffsetHours: v.optional(v.nullable(v.number()))
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
				recurrence: input.recurrence ?? null,
				fulfillmentStartDate: normalizeOptionalDateTime(input.fulfillmentStartDate),
				fulfillmentEndDate: normalizeOptionalDateTime(input.fulfillmentEndDate),
				deadlineOffsetHours: normalizeOptionalInteger(input.deadlineOffsetHours)
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
				recurrence: input.recurrence ?? null,
				fulfillmentStartDate: normalizeOptionalDateTime(input.fulfillmentStartDate),
				fulfillmentEndDate: normalizeOptionalDateTime(input.fulfillmentEndDate),
				deadlineOffsetHours: normalizeOptionalInteger(input.deadlineOffsetHours)
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
