const commonBusinessTimezoneValues = [
	'UTC',
	'America/Los_Angeles',
	'America/Denver',
	'America/Chicago',
	'America/New_York',
	'America/Phoenix',
	'America/Anchorage',
	'Pacific/Honolulu'
] as const;

/**
 * Convert an IANA timezone into a short business-facing label like "Pacific Time".
 * Falls back to the raw timezone identifier when the runtime cannot format it.
 */
export function getBusinessTimezoneDisplayName(value: string): string {
	if (value === 'UTC') return 'UTC';

	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: value,
			timeZoneName: 'longGeneric'
		}).formatToParts(new Date());
		return parts.find((part) => part.type === 'timeZoneName')?.value ?? value;
	} catch {
		return value;
	}
}

/**
 * Build the compact timezone select list used by seller-facing business settings.
 * Always includes the current seller timezone plus a curated set of common US business zones.
 */
export function buildBusinessTimezoneOptions(currentTimezone: string | null) {
	const values = Array.from(
		new Set([currentTimezone ?? 'UTC', ...commonBusinessTimezoneValues].filter(Boolean))
	);

	return values.map((value) => ({
		value,
		label: getBusinessTimezoneDisplayName(value)
	}));
}
