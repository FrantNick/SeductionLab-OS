import { createHash } from "crypto";
import { customAlphabet } from "nanoid";
import { getSetting } from "@/lib/app-settings";

// Unambiguous lowercase alphanumerics — slugs are typed/read by humans.
const slugAlphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const nanoSlug = customAlphabet(slugAlphabet, 8);

export function generateSlug(): string {
  return nanoSlug();
}

/** "Maya Writes!" → "maya-writes" — URL-safe affiliate handle. */
export function slugifyHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Privacy: raw IPs are never stored, only a salted SHA-256 hash. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "seduction-lab-default-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "0.0.0.0"
  );
}

export function getClientCountry(headers: Headers): string | null {
  return (
    headers.get("x-vercel-ip-country") ??
    headers.get("cf-ipcountry") ??
    headers.get("x-country-code") ??
    null
  );
}

/**
 * Base URL used when rendering full tracking links, e.g.
 * https://go.seduction-lab.com. Resolution order: the tracking.domain
 * AppSetting (editable under Admin → Settings — lets the operator point
 * links at a new public domain, e.g. an ngrok URL, without touching .env
 * or rebuilding) → TRACKING_DOMAIN → NEXT_PUBLIC_APP_URL → localhost.
 */
export async function trackingBaseUrl(): Promise<string> {
  let configured = "";
  try {
    configured = String((await getSetting<string>("tracking.domain")) ?? "").trim();
  } catch {
    // DB unavailable (build-time render, first boot) — env fallback below
  }
  const base =
    configured ||
    process.env.TRACKING_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export async function fullTrackingUrl(slug: string): Promise<string> {
  return `${await trackingBaseUrl()}/go/${slug}`;
}

/**
 * Appends query params to a URL. Generic on purpose: parameter names come
 * from the caller (ultimately from AppSettings), never hardcoded, so any
 * storefront (Shopify, Gumroad, LemonSqueezy…) can be pointed at whatever
 * names it reads — and future params are one map entry away.
 */
export function buildLandingUrl(landingUrl: string, params: Record<string, string>): string {
  try {
    const url = new URL(landingUrl);
    for (const [key, value] of Object.entries(params)) {
      // An empty param NAME means "do not append this param" — setting
      // tracking.trackingParam to "" disables the ref param entirely for
      // landing pages that must receive only the affiliate identifier.
      if (key.trim() && value) url.searchParams.set(key.trim(), value);
    }
    return url.toString();
  } catch {
    return landingUrl; // malformed base URL — better to redirect unmodified than to 500
  }
}

/**
 * The URL a tracking link sends visitors to: the product's landing page
 * (identical for every affiliate) plus the affiliate identifier and the
 * link slug, under admin-configured parameter names. The landing page's
 * JS reads the affiliate param and swaps in that affiliate's checkout;
 * the slug param resolves link → affiliate → campaign → thread
 * server-side for webhook attribution.
 */
export async function buildAffiliateDestination(input: {
  landingUrl: string;
  affiliateRef: string;
  slug: string;
}): Promise<string> {
  const [affiliateParam, trackingParam] = await Promise.all([
    getSetting<string>("tracking.affiliateParam"),
    getSetting<string>("tracking.trackingParam"),
  ]);
  return buildLandingUrl(input.landingUrl, {
    [affiliateParam]: input.affiliateRef,
    [trackingParam]: input.slug,
  });
}
