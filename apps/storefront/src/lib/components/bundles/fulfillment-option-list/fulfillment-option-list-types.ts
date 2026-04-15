import type {
	FulfillmentOptionType,
	Weekday
} from '$lib/api/admin/fulfillment-options.remote';

/** Empty-weekday sentinel used in the editor form when no weekday has been chosen yet. */
export type EditorWeekday = Weekday | '';

/** Fulfillment-option row shape used by the inline editor UI. */
export interface FulfillmentOptionEditorRow {
	id: string;
	name: string;
	type: FulfillmentOptionType;
	notes: string;
	fulfillmentWeekday: EditorWeekday;
	fulfillmentTimeWindowStart: string;
	fulfillmentTimeWindowEnd: string;
	orderDeadlineWeekday: EditorWeekday;
	orderDeadlineTime: string;
}

/** Simplified per-option usage counts derived from the seller's loaded offers. */
export interface FulfillmentOptionUsage {
	offerCount: number;
	activeOfferCount: number;
}

/** Input used to produce a human summary of a schedule template. */
export interface ScheduleTemplateSummaryInput {
	type: FulfillmentOptionType;
	fulfillmentWeekday: Weekday | null;
	fulfillmentTimeWindowStart: number | null;
	fulfillmentTimeWindowEnd: number | null;
	orderDeadlineWeekday: Weekday | null;
	orderDeadlineTime: number | null;
}

/** Payload shape sent to the create/update remote mutations. */
export interface FulfillmentOptionMutationInput {
	name: string;
	type: FulfillmentOptionType;
	notes: string | null;
	fulfillmentWeekday: Weekday | null;
	fulfillmentTimeWindowStart: number | null;
	fulfillmentTimeWindowEnd: number | null;
	orderDeadlineWeekday: Weekday | null;
	orderDeadlineTime: number | null;
}

export const fulfillmentOptionTypeOptions: Array<{
	value: FulfillmentOptionType;
	label: string;
}> = [
	{ value: 'scheduled_pickup', label: 'Scheduled Pickup' },
	{ value: 'scheduled_delivery', label: 'Scheduled Delivery' },
	{ value: 'shipping', label: 'Ship' }
];

export const weekdayOptions: Array<{
	value: Weekday;
	label: string;
	shortLabel: string;
}> = [
	{ value: 'monday', label: 'Monday', shortLabel: 'Mon' },
	{ value: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
	{ value: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
	{ value: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
	{ value: 'friday', label: 'Friday', shortLabel: 'Fri' },
	{ value: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
	{ value: 'sunday', label: 'Sunday', shortLabel: 'Sun' }
];
