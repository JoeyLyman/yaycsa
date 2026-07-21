-- ============================================================================
-- Purge orphaned test sellers from the dev database.
--
-- Keeps only the sellers listed in the keep-list below. Everything else — its
-- channel, offers, fulfillment options, and customer links — is removed in
-- FK-safe order, inside a single transaction.
--
-- WHEN TO USE THIS (vs. the teardownSeller Admin-API helper):
--   Prefer tests/setup/seller-helpers.ts -> teardownSeller() for tearing down a
--   seller you just created (it's Admin-API-only and keeps events/indexes in
--   sync). Use THIS script only to clean up sellers that are already stranded —
--   i.e. their linked customer was soft-deleted, which makes the customer
--   unreachable via the Admin API (customer() returns null), so the
--   customer.seller FK can no longer be nulled through the API. Raw SQL is then
--   the only way to free the seller for deletion.
--
-- HOW TO RUN:
--   - Supabase dashboard: paste into the SQL editor and run.
--   - psql: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f purge-test-sellers.sql
--   Run the SELECT at the bottom (or the preview block) first to see the target set.
--
-- KEEP LIST (edit the id list in both temp-table lines if you keep more):
--   id 1 = Default Seller            (required by Vendure core)
--   id 2 = Gathering Together Farm   (default TEST_SELLER_SLUG for the suite)
-- ============================================================================

-- Preview (safe, read-only): what would be purged?
--   SELECT id, name FROM seller WHERE id NOT IN (1, 2) ORDER BY id;

BEGIN;

-- Target set: every seller not in the keep list.
CREATE TEMP TABLE _purge_sellers ON COMMIT DROP AS
	SELECT id FROM seller WHERE id NOT IN (1, 2);

CREATE TEMP TABLE _purge_channels ON COMMIT DROP AS
	SELECT id FROM channel WHERE "sellerId" IN (SELECT id FROM _purge_sellers);

-- 1. Unlink customers (incl. soft-deleted rows the Admin API cannot reach).
UPDATE customer SET "customFieldsSellerid" = NULL
	WHERE "customFieldsSellerid" IN (SELECT id FROM _purge_sellers);

-- 2. Defensive: detach any orders referencing these sellers' offers / options
--    (order -> offer and order -> fulfillment_option are NO ACTION FKs).
UPDATE "order" SET "customFieldsOfferid" = NULL
	WHERE "customFieldsOfferid" IN (SELECT id FROM offer WHERE "sellerId" IN (SELECT id FROM _purge_sellers));
UPDATE "order" SET "customFieldsFulfillmentoptionid" = NULL
	WHERE "customFieldsFulfillmentoptionid" IN (SELECT id FROM fulfillment_option WHERE "sellerId" IN (SELECT id FROM _purge_sellers));

-- 3. Delete the sellers' offers and fulfillment options (join tables cascade).
DELETE FROM offer WHERE "sellerId" IN (SELECT id FROM _purge_sellers);
DELETE FROM fulfillment_option WHERE "sellerId" IN (SELECT id FROM _purge_sellers);

-- 4. Detach sessions from these channels (session.activeChannelId is NO ACTION),
--    then delete the channels (all channel join tables cascade on delete).
UPDATE session SET "activeChannelId" = NULL
	WHERE "activeChannelId" IN (SELECT id FROM _purge_channels);
DELETE FROM channel WHERE id IN (SELECT id FROM _purge_channels);

-- 5. Finally, delete the sellers themselves.
DELETE FROM seller WHERE id IN (SELECT id FROM _purge_sellers);

COMMIT;
