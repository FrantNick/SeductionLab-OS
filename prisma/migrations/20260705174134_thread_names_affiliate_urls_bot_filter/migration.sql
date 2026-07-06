-- Thread naming, per-affiliate product destination overrides and the
-- bot-filter anchor timestamp. Fully additive: existing threads keep
-- null name/description and get createdAt backfilled from postedAt (their
-- original submission time), so the bot filter never mistakes legacy
-- threads for freshly submitted ones.

-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "threadDescription" TEXT,
ADD COLUMN     "threadName" TEXT;

-- Backfill: submission time of pre-existing threads is their postedAt.
UPDATE "Thread" SET "createdAt" = "postedAt";

-- AlterTable
ALTER TABLE "TrackingLink" ADD COLUMN     "threadDescription" TEXT,
ADD COLUMN     "threadName" TEXT;

-- CreateTable
CREATE TABLE "AffiliateProductUrl" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProductUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProductUrl_affiliateId_productId_key" ON "AffiliateProductUrl"("affiliateId", "productId");

-- AddForeignKey
ALTER TABLE "AffiliateProductUrl" ADD CONSTRAINT "AffiliateProductUrl_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProductUrl" ADD CONSTRAINT "AffiliateProductUrl_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
