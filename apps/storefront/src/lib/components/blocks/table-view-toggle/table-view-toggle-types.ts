/**
 * Audience lens for an offer table.
 *
 * - `customer` — render only buyer-facing fields, exactly as the public seller
 *   page (`/[seller]`) shows them. On the admin page this doubles as a live
 *   "preview what my buyers see".
 * - `admin`    — render the full seller-facing superset (status, commitments,
 *   internal notes, activation/edit controls).
 *
 * Edit mode only exists inside `admin`; entering edit mode forces this to
 * `admin` and locks the toggle.
 */
export type TableAudience = 'customer' | 'admin';

/** Flip between the two audience lenses. */
export function nextTableAudience(currentAudience: TableAudience): TableAudience {
	return currentAudience === 'customer' ? 'admin' : 'customer';
}
