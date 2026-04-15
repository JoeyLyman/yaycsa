import type {
	FulfillmentOptionType,
	Weekday
} from '$lib/api/admin/fulfillment-options.remote';
import type {
	SellerFulfillmentOptionWorkspaceItem,
	SellerOfferWorkspaceItem
} from '$lib/api/admin/offers.remote';
import {
	fulfillmentOptionTypeOptions,
	weekdayOptions,
	type FulfillmentOptionEditorRow,
	type FulfillmentOptionMutationInput,
	type FulfillmentOptionUsage,
	type ScheduleTemplateSummaryInput
} from './fulfillment-option-list-types';

export function isScheduledFulfillmentOptionType(type: FulfillmentOptionType): boolean {
	return type === 'scheduled_pickup' || type === 'scheduled_delivery';
}

export function getFulfillmentOptionTypeLabel(type: FulfillmentOptionType): string {
	return fulfillmentOptionTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function getWeekdayLabel(weekday: Weekday | null): string {
	if (!weekday) return '—';
	return weekdayOptions.find((option) => option.value === weekday)?.label ?? weekday;
}

export function getWeekdayShortLabel(weekday: Weekday | null): string {
	if (!weekday) return '—';
	return weekdayOptions.find((option) => option.value === weekday)?.shortLabel ?? weekday;
}

export function formatMinutesFromMidnight(value: number | null): string {
	if (value == null || !Number.isInteger(value) || value < 0 || value > 1439) return '—';
	const hours24 = Math.floor(value / 60);
	const minutes = value % 60;
	const meridiem = hours24 >= 12 ? 'PM' : 'AM';
	const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
	return `${hours12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

/** Options shown in the time-of-day combobox. Dense grid of 15-minute increments across the full day. */
export const timeOfDayOptions: Array<{ value: string; label: string }> = Array.from(
	{ length: 96 },
	(_, index) => {
		const minutes = index * 15;
		const hours24 = Math.floor(minutes / 60);
		const minuteRemainder = minutes % 60;
		const value = `${String(hours24).padStart(2, '0')}:${String(minuteRemainder).padStart(2, '0')}`;
		const meridiem = hours24 >= 12 ? 'PM' : 'AM';
		const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
		const label = `${hours12}:${String(minuteRemainder).padStart(2, '0')} ${meridiem}`;
		return { value, label };
	}
);

export function minutesToTimeInputValue(value: number | null): string {
	if (value == null || !Number.isInteger(value) || value < 0 || value > 1439) return '';
	const hours = Math.floor(value / 60);
	const minutes = value % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Parse a time input string. Returns null for empty, a number of minutes from midnight, or 'invalid'. */
export function parseTimeInputValue(value: string): number | null | 'invalid' {
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
	if (!match) return 'invalid';
	const hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 'invalid';
	return hours * 60 + minutes;
}

export function buildScheduleTemplateSummaryInput(
	row: FulfillmentOptionEditorRow
): ScheduleTemplateSummaryInput {
	const fulfillmentTimeWindowStart = parseTimeInputValue(row.fulfillmentTimeWindowStart);
	const fulfillmentTimeWindowEnd = parseTimeInputValue(row.fulfillmentTimeWindowEnd);
	const orderDeadlineTime = parseTimeInputValue(row.orderDeadlineTime);

	return {
		type: row.type,
		fulfillmentWeekday: row.fulfillmentWeekday || null,
		fulfillmentTimeWindowStart:
			typeof fulfillmentTimeWindowStart === 'number' ? fulfillmentTimeWindowStart : null,
		fulfillmentTimeWindowEnd:
			typeof fulfillmentTimeWindowEnd === 'number' ? fulfillmentTimeWindowEnd : null,
		orderDeadlineWeekday: row.orderDeadlineWeekday || null,
		orderDeadlineTime: typeof orderDeadlineTime === 'number' ? orderDeadlineTime : null
	};
}

/** Fulfillment meta-row summary, e.g. "Tuesday · 3:00 PM–5:00 PM" or "—". */
export function summarizeFulfillmentTiming(input: ScheduleTemplateSummaryInput): string {
	if (
		!input.fulfillmentWeekday ||
		input.fulfillmentTimeWindowStart == null ||
		input.fulfillmentTimeWindowEnd == null
	) {
		return '—';
	}
	return `${getWeekdayLabel(input.fulfillmentWeekday)} · ${formatMinutesFromMidnight(
		input.fulfillmentTimeWindowStart
	)}–${formatMinutesFromMidnight(input.fulfillmentTimeWindowEnd)}`;
}

/** Order-deadline meta-row summary, e.g. "Sunday · by 8:00 PM" or the no-override label for shipping. */
export function summarizeOrderDeadline(input: ScheduleTemplateSummaryInput): string {
	if (!input.orderDeadlineWeekday || input.orderDeadlineTime == null) {
		if (input.type === 'shipping') return 'No deadline override';
		return '—';
	}
	return `${getWeekdayLabel(input.orderDeadlineWeekday)} · by ${formatMinutesFromMidnight(
		input.orderDeadlineTime
	)}`;
}

/** Notes meta-row summary. Empty notes render as an em-dash. */
export function summarizeNotes(notes: string): string {
	const trimmed = notes.trim();
	return trimmed.length > 0 ? trimmed : '—';
}

/** Short type-and-usage helper line shown under the row's name. */
export function summarizeTypeAndUsage(
	type: FulfillmentOptionType,
	usage: FulfillmentOptionUsage
): string {
	return `${getFulfillmentOptionTypeLabel(type)} · ${summarizeFulfillmentOptionUsage(usage)}`;
}

/** Usage label derived from offers. No "historical" language — either active, in use, or unused. */
export function summarizeFulfillmentOptionUsage(usage: FulfillmentOptionUsage): string {
	if (usage.activeOfferCount > 0) {
		return usage.activeOfferCount === 1
			? '1 active offer'
			: `${usage.activeOfferCount} active offers`;
	}
	if (usage.offerCount > 0) {
		return usage.offerCount === 1 ? 'Used by 1 offer' : `Used by ${usage.offerCount} offers`;
	}
	return 'Unused';
}

export function toEditorRow(
	fulfillmentOption: SellerFulfillmentOptionWorkspaceItem
): FulfillmentOptionEditorRow {
	return {
		id: fulfillmentOption.id,
		name: fulfillmentOption.name,
		type: fulfillmentOption.type,
		notes: fulfillmentOption.notes ?? '',
		fulfillmentWeekday: fulfillmentOption.fulfillmentWeekday ?? '',
		fulfillmentTimeWindowStart: minutesToTimeInputValue(
			fulfillmentOption.fulfillmentTimeWindowStart
		),
		fulfillmentTimeWindowEnd: minutesToTimeInputValue(fulfillmentOption.fulfillmentTimeWindowEnd),
		orderDeadlineWeekday: fulfillmentOption.orderDeadlineWeekday ?? '',
		orderDeadlineTime: minutesToTimeInputValue(fulfillmentOption.orderDeadlineTime)
	};
}

export function createBlankFulfillmentOptionEditorRow(id: string): FulfillmentOptionEditorRow {
	return {
		id,
		name: '',
		type: 'scheduled_pickup',
		notes: '',
		fulfillmentWeekday: '',
		fulfillmentTimeWindowStart: '',
		fulfillmentTimeWindowEnd: '',
		orderDeadlineWeekday: '',
		orderDeadlineTime: ''
	};
}

export function sortFulfillmentOptionEditorRows(
	rows: FulfillmentOptionEditorRow[]
): FulfillmentOptionEditorRow[] {
	return [...rows].sort((left, right) => left.name.localeCompare(right.name));
}

/** Derive per-fulfillment-option usage counts from the seller's loaded offers. */
export function deriveFulfillmentOptionUsage(
	offers: SellerOfferWorkspaceItem[]
): Map<string, FulfillmentOptionUsage> {
	const usage = new Map<string, FulfillmentOptionUsage>();
	for (const offer of offers) {
		const isActive = offer.status === 'active';
		for (const optionId of offer.fulfillmentOptionIds) {
			const existing = usage.get(optionId) ?? { offerCount: 0, activeOfferCount: 0 };
			existing.offerCount += 1;
			if (isActive) existing.activeOfferCount += 1;
			usage.set(optionId, existing);
		}
	}
	return usage;
}

export function getUsageForOption(
	usageMap: Map<string, FulfillmentOptionUsage>,
	fulfillmentOptionId: string
): FulfillmentOptionUsage {
	return usageMap.get(fulfillmentOptionId) ?? { offerCount: 0, activeOfferCount: 0 };
}

/** Returns a field patch that clears schedule fields when switching to shipping. */
export function buildTypePatch(nextType: FulfillmentOptionType): Partial<FulfillmentOptionEditorRow> {
	if (nextType === 'shipping') {
		return {
			type: nextType,
			fulfillmentWeekday: '',
			fulfillmentTimeWindowStart: '',
			fulfillmentTimeWindowEnd: ''
		};
	}

	return { type: nextType };
}

/** Collect client-side validation errors for a fulfillment-option editor row. */
export function getRowValidationErrors(
	row: FulfillmentOptionEditorRow,
	otherRows: FulfillmentOptionEditorRow[]
): string[] {
	const errors: string[] = [];
	const trimmedName = row.name.trim();

	if (trimmedName.length < 2) {
		errors.push('Name must be at least 2 characters.');
	}

	if (
		trimmedName.length > 0 &&
		otherRows.some(
			(otherRow) =>
				otherRow.id !== row.id && otherRow.name.trim().toLowerCase() === trimmedName.toLowerCase()
		)
	) {
		errors.push('Name must be unique within your fulfillment options.');
	}

	const orderDeadlineTime = parseTimeInputValue(row.orderDeadlineTime);

	if (!isScheduledFulfillmentOptionType(row.type)) {
		if (row.type === 'shipping') {
			const hasWeekday = Boolean(row.orderDeadlineWeekday);
			const hasTime = orderDeadlineTime !== null && orderDeadlineTime !== 'invalid';

			if (orderDeadlineTime === 'invalid') {
				errors.push('Order deadline time must use HH:MM format.');
			}
			if (hasWeekday !== hasTime) {
				errors.push('Set both a deadline weekday and time, or leave both blank.');
			}
		}
		return errors;
	}

	const fulfillmentTimeWindowStart = parseTimeInputValue(row.fulfillmentTimeWindowStart);
	const fulfillmentTimeWindowEnd = parseTimeInputValue(row.fulfillmentTimeWindowEnd);

	if (!row.fulfillmentWeekday) {
		errors.push('Scheduled options require a fulfillment weekday.');
	}

	if (!row.orderDeadlineWeekday) {
		errors.push('Scheduled options require an order deadline weekday.');
	}

	if (fulfillmentTimeWindowStart === null) {
		errors.push('Scheduled options require a fulfillment start time.');
	} else if (fulfillmentTimeWindowStart === 'invalid') {
		errors.push('Fulfillment start time must use HH:MM format.');
	}

	if (fulfillmentTimeWindowEnd === null) {
		errors.push('Scheduled options require a fulfillment end time.');
	} else if (fulfillmentTimeWindowEnd === 'invalid') {
		errors.push('Fulfillment end time must use HH:MM format.');
	}

	if (orderDeadlineTime === null) {
		errors.push('Scheduled options require an order deadline time.');
	} else if (orderDeadlineTime === 'invalid') {
		errors.push('Order deadline time must use HH:MM format.');
	}

	if (
		typeof fulfillmentTimeWindowStart === 'number' &&
		typeof fulfillmentTimeWindowEnd === 'number' &&
		fulfillmentTimeWindowEnd < fulfillmentTimeWindowStart
	) {
		errors.push('Fulfillment end time must be at or after the start time.');
	}

	return errors;
}

export function rowToMutationInput(row: FulfillmentOptionEditorRow): FulfillmentOptionMutationInput {
	const scheduleTemplate = buildScheduleTemplateSummaryInput(row);
	return {
		name: row.name.trim(),
		type: row.type,
		notes: row.notes.trim() || null,
		fulfillmentWeekday: scheduleTemplate.fulfillmentWeekday,
		fulfillmentTimeWindowStart: scheduleTemplate.fulfillmentTimeWindowStart,
		fulfillmentTimeWindowEnd: scheduleTemplate.fulfillmentTimeWindowEnd,
		orderDeadlineWeekday: scheduleTemplate.orderDeadlineWeekday,
		orderDeadlineTime: scheduleTemplate.orderDeadlineTime
	};
}

export function isRowDirty(
	current: FulfillmentOptionEditorRow,
	snapshot: FulfillmentOptionEditorRow
): boolean {
	return JSON.stringify(current) !== JSON.stringify(snapshot);
}
