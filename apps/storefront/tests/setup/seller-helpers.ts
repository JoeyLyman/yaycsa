/**
 * Shared Admin API helpers for creating and (importantly) tearing down sellers
 * in tests and smoke sessions.
 *
 * WHY THIS EXISTS — the seller teardown FK trap:
 *   The `becomeSeller` flow creates three linked rows in one transaction:
 *     1. a Seller
 *     2. a Channel        (channel.sellerId  -> seller, a NOT NULL FK)
 *     3. a Customer link  (customer.customFields.seller -> seller)
 *
 *   Two Vendure behaviors collide when you try to clean that up:
 *     - `deleteSeller` is a HARD delete, so BOTH FKs above must be cleared first.
 *     - `deleteCustomer` is a SOFT delete: it sets `deletedAt` but keeps the row,
 *       which still holds `customFields.seller`. Worse, once soft-deleted the
 *       customer is UNREACHABLE via the Admin API (`customer(id)` returns null,
 *       `updateCustomer` throws ENTITY_NOT_FOUND) — so you can no longer null the
 *       FK to free the seller. Deleting the customer first permanently strands
 *       the seller (only raw SQL can recover it).
 *
 *   The fix is ordering: unlink the customer WHILE IT IS STILL LIVE, then delete
 *   the channel, then the seller, and only soft-delete the customer last.
 */

const ADMIN_API = 'http://localhost:3000/admin-api';

/** Superadmin credentials (dev-only defaults, matching auth.setup.ts). */
const SUPERADMIN_IDENTIFIER = 'superadmin';
const SUPERADMIN_PASSWORD = 'superadmin';

/** Authenticate with the Vendure Admin API and return a bearer token. */
export async function getAdminToken(): Promise<string> {
	const res = await fetch(ADMIN_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			query: `mutation Login($username: String!, $password: String!) {
				login(username: $username, password: $password, rememberMe: false) {
					... on CurrentUser { id }
					... on InvalidCredentialsError { message }
				}
			}`,
			variables: { username: SUPERADMIN_IDENTIFIER, password: SUPERADMIN_PASSWORD },
		}),
	});
	const token = res.headers.get('vendure-auth-token');
	if (!token) throw new Error('Failed to get admin token — is the Vendure server running?');
	return token;
}

/**
 * Execute an authenticated Admin API GraphQL request and return `data`.
 * Throws on transport errors or GraphQL `errors` so callers fail loudly.
 */
async function adminGraphql<T = unknown>(
	adminToken: string,
	query: string,
	variables?: Record<string, unknown>
): Promise<T> {
	const res = await fetch(ADMIN_API, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${adminToken}`,
		},
		body: JSON.stringify({ query, variables }),
	});
	const body = await res.json();
	if (body.errors?.length) {
		throw new Error(`Admin API error: ${JSON.stringify(body.errors)}`);
	}
	return body.data as T;
}

/**
 * Resolve the channel id that belongs to a seller.
 * Vendure has no direct "channel by seller" query, so we list channels and
 * match on the embedded seller id. Returns null if the seller has no channel
 * (e.g. it was already partially torn down).
 */
async function findChannelIdForSeller(adminToken: string, sellerId: string): Promise<string | null> {
	const data = await adminGraphql<{ channels: { items: Array<{ id: string; seller?: { id: string } | null }> } }>(
		adminToken,
		`query { channels { items { id seller { id } } } }`
	);
	const match = data.channels.items.find((c) => c.seller?.id === sellerId);
	return match?.id ?? null;
}

/** Options controlling how far {@link teardownSeller} goes. */
export type TeardownSellerOptions = {
	/** The seller to remove (required). */
	sellerId: string;
	/**
	 * The customer linked to this seller, if known. When provided, the customer
	 * is unlinked (and, unless `keepCustomer` is set, soft-deleted). Passing this
	 * is what keeps the FK from stranding the seller — always pass it if you have it.
	 */
	customerId?: string;
	/**
	 * The seller's channel id. Optional — if omitted it is resolved from the
	 * seller. Pass it to save a round-trip when you already know it.
	 */
	channelId?: string;
	/**
	 * When true, the linked customer is unlinked but NOT deleted (useful if a
	 * single customer account is reused across tests). Defaults to false.
	 */
	keepCustomer?: boolean;
};

/**
 * Fully tear down a seller created via `becomeSeller`, in FK-safe order.
 *
 * Steps (each is a no-op if the target doesn't exist):
 *   1. Unlink the customer  (updateCustomer customFields.sellerId = null) — MUST
 *      run before the customer is deleted, or the FK strands the seller.
 *   2. Delete the channel   (clears channel.sellerId; join tables cascade).
 *   3. Delete the seller    (hard delete now succeeds).
 *   4. Delete the customer  (soft delete, last) — skipped when keepCustomer.
 *
 * Idempotent-ish: safe to call after a partial teardown; missing pieces are skipped.
 */
export async function teardownSeller(
	adminToken: string,
	{ sellerId, customerId, channelId, keepCustomer = false }: TeardownSellerOptions
): Promise<void> {
	// 1. Unlink the customer while it is still live and reachable.
	if (customerId) {
		await adminGraphql(
			adminToken,
			`mutation Unlink($id: ID!) {
				updateCustomer(input: { id: $id, customFields: { sellerId: null } }) {
					... on Customer { id }
					... on ErrorResult { errorCode message }
				}
			}`,
			{ id: customerId }
		);
	}

	// 2. Delete the channel (resolve it from the seller if not supplied).
	const resolvedChannelId = channelId ?? (await findChannelIdForSeller(adminToken, sellerId));
	if (resolvedChannelId) {
		await adminGraphql(
			adminToken,
			`mutation DeleteChannel($id: ID!) { deleteChannel(id: $id) { result message } }`,
			{ id: resolvedChannelId }
		);
	}

	// 3. Delete the seller (both FKs are now clear, so the hard delete succeeds).
	await adminGraphql(
		adminToken,
		`mutation DeleteSeller($id: ID!) { deleteSeller(id: $id) { result message } }`,
		{ id: sellerId }
	);

	// 4. Soft-delete the customer last (its seller FK is already null).
	if (customerId && !keepCustomer) {
		await adminGraphql(
			adminToken,
			`mutation DeleteCustomer($id: ID!) { deleteCustomer(id: $id) { result message } }`,
			{ id: customerId }
		);
	}
}
