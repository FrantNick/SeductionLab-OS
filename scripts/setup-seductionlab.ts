/**
 * One-shot, idempotent production data setup for seduction-lab.com:
 *
 *   npx tsx scripts/setup-seductionlab.ts
 *
 * Creates/updates (never duplicates, never touches clicks or conversions):
 *   - Product  "The STORY Method"    → landing page /products/the-story-method
 *   - Product  "The QUESTION Method" → landing page /products/the-question-method
 *   - Affiliate "TheManDecoded" (handle: themandecoded) + login user
 *   - One ACTIVE campaign per product when the product has none yet
 *   - ACTIVE assignments putting TheManDecoded on every campaign of both products
 *
 * Admin-UI equivalent: Products → add both products with their landing URLs;
 * Affiliates ← the affiliate registers (handle auto-generates) or you adjust
 * data directly; Campaigns → create one per product and assign the affiliate.
 *
 * Env overrides: SETUP_AFFILIATE_EMAIL, SETUP_AFFILIATE_PASSWORD (a random
 * password is generated and printed when the user does not exist yet).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const PRODUCTS = [
  {
    id: "prod-the-story-method",
    name: "The STORY Method",
    price: 69,
    landingUrl: "https://www.seduction-lab.com/products/the-story-method",
  },
  {
    id: "prod-the-question-method",
    name: "The QUESTION Method",
    price: 69,
    landingUrl: "https://www.seduction-lab.com/products/the-question-method",
  },
];

const AFFILIATE = {
  displayName: "TheManDecoded",
  handle: "themandecoded",
  email: (process.env.SETUP_AFFILIATE_EMAIL ?? "themandecoded@seduction-lab.com").toLowerCase(),
};

async function main() {
  // 1. Products — update landing URL/name in place when they already exist.
  const products = [];
  for (const spec of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { id: spec.id },
      update: { name: spec.name, landingUrl: spec.landingUrl },
      create: spec,
    });
    products.push(product);
    console.log(`✓ product "${product.name}" → ${product.landingUrl}`);
  }

  // 2. Affiliate — reuse by handle first, then by email; create as a last resort.
  let affiliate = await prisma.affiliate.findUnique({ where: { handle: AFFILIATE.handle } });
  if (!affiliate) {
    const existingUser = await prisma.user.findUnique({
      where: { email: AFFILIATE.email },
      include: { affiliate: true },
    });
    if (existingUser?.affiliate) {
      affiliate = await prisma.affiliate.update({
        where: { id: existingUser.affiliate.id },
        data: { handle: AFFILIATE.handle },
      });
      console.log(`✓ affiliate ${affiliate.displayName}: handle set to "${AFFILIATE.handle}"`);
    } else {
      const password = process.env.SETUP_AFFILIATE_PASSWORD ?? randomBytes(9).toString("base64url");
      const user = await prisma.user.create({
        data: {
          email: AFFILIATE.email,
          password: await bcrypt.hash(password, 12),
          role: "AFFILIATE",
          affiliate: {
            create: {
              displayName: AFFILIATE.displayName,
              handle: AFFILIATE.handle,
              status: "ACTIVE",
            },
          },
        },
        include: { affiliate: true },
      });
      affiliate = user.affiliate!;
      console.log(`✓ affiliate created: ${AFFILIATE.email}`);
      if (!process.env.SETUP_AFFILIATE_PASSWORD) {
        console.log(`  temporary password (change after first login): ${password}`);
      }
    }
  } else {
    console.log(`✓ affiliate "${affiliate.displayName}" already has handle "${affiliate.handle}"`);
  }

  // 3. Campaigns — ensure each product has at least one, then assign the
  //    affiliate to every campaign of both products.
  for (const product of products) {
    let campaigns = await prisma.campaign.findMany({ where: { productId: product.id } });
    if (campaigns.length === 0) {
      const campaign = await prisma.campaign.create({
        data: {
          name: `${product.name} — general`,
          productId: product.id,
          angle: `Default angle for ${product.name} (edit in Admin → Campaigns)`,
          status: "ACTIVE",
          startDate: new Date(),
        },
      });
      campaigns = [campaign];
      console.log(`✓ campaign "${campaign.name}" created (none existed for this product)`);
    }
    for (const campaign of campaigns) {
      await prisma.campaignAssignment.upsert({
        where: {
          campaignId_affiliateId: { campaignId: campaign.id, affiliateId: affiliate.id },
        },
        update: { status: "ACTIVE" },
        create: { campaignId: campaign.id, affiliateId: affiliate.id, status: "ACTIVE" },
      });
      console.log(`✓ ${AFFILIATE.displayName} assigned to "${campaign.name}"`);
    }
  }

  console.log(
    "\nDone. Tracking links created in these campaigns will redirect to\n" +
      `  ${PRODUCTS[0].landingUrl}?affiliate=${AFFILIATE.handle}&ref=<slug>\n` +
      `  ${PRODUCTS[1].landingUrl}?affiliate=${AFFILIATE.handle}&ref=<slug>\n` +
      "(param names configurable under Admin → Settings → Affiliate tracking)",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
