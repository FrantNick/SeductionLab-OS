-- Product.checkoutUrl becomes landingUrl: same column, renamed in place so
-- every existing URL is preserved (operators update values to real landing
-- pages from the admin UI at their own pace).
ALTER TABLE "Product" RENAME COLUMN "checkoutUrl" TO "landingUrl";

-- Affiliate.handle: URL-safe identifier used in landing-page URLs
-- (?affiliate=<handle>). Backfilled from displayName, slugified; ties get a
-- numeric suffix so the unique index always succeeds.
ALTER TABLE "Affiliate" ADD COLUMN "handle" TEXT;

UPDATE "Affiliate" a
SET "handle" = CASE WHEN s.rn = 1 THEN s.base ELSE s.base || '-' || s.rn END
FROM (
  SELECT id,
         base,
         row_number() OVER (PARTITION BY base ORDER BY id) AS rn
  FROM (
    SELECT id,
           COALESCE(
             NULLIF(btrim(lower(regexp_replace("displayName", '[^a-zA-Z0-9]+', '-', 'g')), '-'), ''),
             'affiliate'
           ) AS base
    FROM "Affiliate"
  ) slugs
) s
WHERE a.id = s.id;

CREATE UNIQUE INDEX "Affiliate_handle_key" ON "Affiliate"("handle");
