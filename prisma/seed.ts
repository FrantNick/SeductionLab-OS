import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AI_FEATURES, DEFAULT_PROMPTS } from "../src/lib/ai/registry";
import { FLAG_DEFS } from "../src/lib/feature-flags";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@seduction-lab.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
const SEED_DEMO = (process.env.SEED_DEMO_DATA ?? "true").toLowerCase() === "true";

async function seedAdmin() {
  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL.toLowerCase() },
    update: {},
    create: { email: ADMIN_EMAIL.toLowerCase(), password, role: "ADMIN" },
  });
  console.log(`✓ admin: ${ADMIN_EMAIL}`);
}

/**
 * Registers platform defaults (idempotent): feature flags, the starter
 * prompt library and one AiModelConfig row per AI feature. No providers,
 * keys or demo AI data — features stay honestly "not configured" until
 * an admin connects a real provider.
 */
async function seedPlatform() {
  for (const def of FLAG_DEFS) {
    await prisma.featureFlag.upsert({
      where: { key: def.key },
      update: {}, // never clobber an admin's toggle
      create: { key: def.key, name: def.name, description: def.description, enabled: def.default },
    });
  }
  console.log(`✓ ${FLAG_DEFS.length} feature flags registered`);

  for (const def of DEFAULT_PROMPTS) {
    const existing = await prisma.prompt.findUnique({ where: { slug: def.slug } });
    if (existing) continue;
    const prompt = await prisma.prompt.create({
      data: { slug: def.slug, name: def.name, category: def.category },
    });
    const version = await prisma.promptVersion.create({
      data: {
        promptId: prompt.id,
        version: 1,
        content: def.content,
        variables: def.variables,
        notes: "Seeded default",
      },
    });
    await prisma.prompt.update({
      where: { id: prompt.id },
      data: { activeVersionId: version.id },
    });
  }
  console.log(`✓ ${DEFAULT_PROMPTS.length} default prompts installed`);

  for (const feature of AI_FEATURES) {
    const prompt = await prisma.prompt.findUnique({
      where: { slug: feature.defaultPromptSlug },
      select: { id: true },
    });
    await prisma.aiModelConfig.upsert({
      where: { feature: feature.feature },
      update: {}, // keep any admin-tuned config
      create: {
        feature: feature.feature,
        name: feature.name,
        systemPromptId: prompt?.id ?? null,
      },
    });
  }
  console.log(`✓ ${AI_FEATURES.length} AI feature configs registered (disabled until a provider is connected)`);
}

async function seedDemo() {
  const affiliatePassword = await bcrypt.hash("affiliate123", 12);

  const affiliateSpecs = [
    { email: "maya@example.com", displayName: "Maya Writes" },
    { email: "dex@example.com", displayName: "Dex Growth" },
    { email: "lena@example.com", displayName: "Lena Hooks" },
  ];

  const affiliates = [];
  for (const spec of affiliateSpecs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        password: affiliatePassword,
        role: "AFFILIATE",
        affiliate: { create: { displayName: spec.displayName } },
      },
      include: { affiliate: true },
    });
    affiliates.push(user.affiliate!);
  }
  console.log(`✓ ${affiliates.length} demo affiliates (password: affiliate123)`);

  const ebook = await prisma.product.upsert({
    where: { id: "seed-product-ebook" },
    update: {},
    create: {
      id: "seed-product-ebook",
      name: "The Magnetic Opener (ebook)",
      price: 39,
      checkoutUrl: "https://seductionlab.gumroad.com/l/magnetic-opener",
    },
  });
  const course = await prisma.product.upsert({
    where: { id: "seed-product-course" },
    update: {},
    create: {
      id: "seed-product-course",
      name: "Conversation Lab (video course)",
      price: 149,
      checkoutUrl: "https://seductionlab.gumroad.com/l/conversation-lab",
    },
  });
  console.log("✓ 2 demo products");

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

  const campaignSpecs = [
    {
      id: "seed-campaign-first-impression",
      name: "First Impression Reset",
      productId: ebook.id,
      angle: "Your opener decides the whole interaction — fix it in 7 days",
      instructions:
        "Thread format: 1 hook, 5-7 value tweets, 1 CTA.\nUse a personal before/after story. No hype words, no emojis in the hook.",
      exampleHook: "I said the same 9 words to 30 strangers. 24 kept talking to me. Here's the script:",
      exampleCTA: "I broke the full method down into a 40-page playbook. Link below — today only $39.",
      status: "ACTIVE" as const,
      startDate: daysAgo(21),
      endDate: null,
    },
    {
      id: "seed-campaign-conversation",
      name: "Never Run Dry",
      productId: course.id,
      angle: "Dead conversations are a skill problem, not a personality problem",
      instructions:
        "Target audience: introverted men 22-35.\nLead with the pain of awkward silence, resolve with one framework tweet.",
      exampleHook: "Conversations don't die because you're boring. They die because you ask dead-end questions.",
      exampleCTA: "Conversation Lab has 6 hours of live-recorded breakdowns. Link below.",
      status: "ACTIVE" as const,
      startDate: daysAgo(14),
      endDate: null,
    },
    {
      id: "seed-campaign-texting",
      name: "Texting Momentum (draft)",
      productId: ebook.id,
      angle: "Why your texts get left on read — and the 3-message fix",
      instructions: "Draft — briefing not final.",
      exampleHook: "",
      exampleCTA: "",
      status: "DRAFT" as const,
      startDate: null,
      endDate: null,
    },
  ];

  const campaigns = [];
  for (const spec of campaignSpecs) {
    campaigns.push(
      await prisma.campaign.upsert({ where: { id: spec.id }, update: {}, create: spec }),
    );
  }
  console.log(`✓ ${campaigns.length} demo campaigns`);

  const active = campaigns.filter((c) => c.status === "ACTIVE");
  for (const campaign of active) {
    for (const affiliate of affiliates) {
      await prisma.campaignAssignment.upsert({
        where: { campaignId_affiliateId: { campaignId: campaign.id, affiliateId: affiliate.id } },
        update: {},
        create: { campaignId: campaign.id, affiliateId: affiliate.id, status: "ACTIVE" },
      });
    }
  }
  console.log("✓ assignments (every affiliate on every active campaign)");

  // Deterministic pseudo-random so reseeding is stable.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const productOf = new Map(campaigns.map((c) => [c.id, c.productId]));
  let threadCount = 0;
  let clickCount = 0;
  let conversionCount = 0;

  for (const campaign of active) {
    for (const [ai, affiliate] of affiliates.entries()) {
      // Tracking link per (affiliate, campaign)
      const slug = `${campaign.id.slice(-4)}${ai}demo`.replace(/[^a-z0-9]/g, "").slice(0, 10);
      const checkoutUrl =
        campaign.productId === ebook.id ? ebook.checkoutUrl : course.checkoutUrl;
      const link = await prisma.trackingLink.upsert({
        where: { slug },
        update: {},
        create: {
          affiliateId: affiliate.id,
          campaignId: campaign.id,
          productId: campaign.productId,
          slug,
          destinationUrl: `${checkoutUrl}?utm_source=twitter&utm_medium=affiliate&utm_campaign=${campaign.id}&utm_content=${affiliate.id}&ref=${slug}`,
        },
      });

      // One thread per affiliate per campaign with growing metric snapshots
      const twitterId = `18${(threadCount + 10).toString().padStart(8, "0")}${ai}${threadCount}`;
      const existingThread = await prisma.thread.findUnique({
        where: { affiliateId_twitterId: { affiliateId: affiliate.id, twitterId } },
      });
      if (!existingThread) {
        const postedAt = daysAgo(10 - ai * 2);
        const thread = await prisma.thread.create({
          data: {
            affiliateId: affiliate.id,
            campaignId: campaign.id,
            twitterUrl: `https://x.com/demo_${affiliate.displayName.split(" ")[0].toLowerCase()}/status/${twitterId}`,
            twitterId,
            text: `${campaign.exampleHook || campaign.angle} (demo thread by ${affiliate.displayName})`,
            postedAt,
          },
        });
        threadCount++;

        const baseViews = 3000 + Math.floor(rand() * 30000);
        const snapshots = 4;
        for (let s = 0; s < snapshots; s++) {
          const growth = (s + 1) / snapshots;
          const views = Math.floor(baseViews * growth);
          await prisma.threadMetrics.create({
            data: {
              threadId: thread.id,
              views,
              likes: Math.floor(views * 0.02 * (0.7 + rand() * 0.6)),
              replies: Math.floor(views * 0.004 * (0.7 + rand() * 0.6)),
              retweets: Math.floor(views * 0.006 * (0.7 + rand() * 0.6)),
              quotes: Math.floor(views * 0.001 * (0.7 + rand() * 0.6)),
              scrapedAt: new Date(postedAt.getTime() + (s + 1) * 36 * 60 * 60 * 1000),
            },
          });
        }

        // Clicks over the last 10 days
        const totalClicks = Math.floor(baseViews * (0.008 + rand() * 0.02));
        const clickRows = [];
        for (let i = 0; i < totalClicks; i++) {
          const when = new Date(now - Math.floor(rand() * 10 * 24) * 60 * 60 * 1000);
          clickRows.push({
            trackingLinkId: link.id,
            affiliateId: affiliate.id,
            campaignId: campaign.id,
            ipHash: `seedhash${Math.floor(rand() * 1e9).toString(16)}`,
            userAgent: "Mozilla/5.0 (seed)",
            country: ["US", "GB", "DE", "CA", "AU"][Math.floor(rand() * 5)],
            createdAt: when,
          });
        }
        await prisma.click.createMany({ data: clickRows });
        clickCount += clickRows.length;

        // Conversions: a few manual sales
        const sales = Math.floor(totalClicks * (0.01 + rand() * 0.03));
        const price = campaign.productId === ebook.id ? 39 : 149;
        for (let i = 0; i < sales; i++) {
          await prisma.conversion.create({
            data: {
              affiliateId: affiliate.id,
              campaignId: campaign.id,
              productId: productOf.get(campaign.id)!,
              revenue: price,
              createdAt: new Date(now - Math.floor(rand() * 9 * 24) * 60 * 60 * 1000),
            },
          });
          conversionCount++;
        }
      }
    }
  }
  console.log(`✓ ${threadCount} threads · ${clickCount} clicks · ${conversionCount} conversions`);
}

async function main() {
  await seedAdmin();
  await seedPlatform();
  if (SEED_DEMO) {
    await seedDemo();
    console.log("Demo data seeded. Log in as maya@example.com / affiliate123 to see the affiliate view.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
