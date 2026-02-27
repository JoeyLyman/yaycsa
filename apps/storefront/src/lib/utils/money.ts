/**
 * Format a price in cents to a dollar string.
 * e.g. 400 → "$4.00", 250 → "$2.50"
 */
export function formatMoney(cents: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(cents / 100);
}
