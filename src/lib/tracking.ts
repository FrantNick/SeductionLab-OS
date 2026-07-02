import { createHash } from "crypto";
import { customAlphabet } from "nanoid";

// Unambiguous lowercase alphanumerics — slugs are typed/read by humans.
const slugAlphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const nanoSlug = customAlphabet(slugAlphabet, 8);

export function generateSlug(): string {
  return nanoSlug();
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

/** Base URL used when rendering full tracking links, e.g. https://go.seduction-lab.com */
export function trackingBaseUrl(): string {
  return (
    process.env.TRACKING_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function fullTrackingUrl(slug: string): string {
  return `${trackingBaseUrl()}/go/${slug}`;
}

/**
 * Destination = product checkout URL + attribution params, so the
 * downstream store can see where the buyer came from even in V1.
 */
export function buildDestinationUrl(
  checkoutUrl: string,
  params: { slug: string; campaignId: string; affiliateId: string },
): string {
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set("utm_source", "twitter");
    url.searchParams.set("utm_medium", "affiliate");
    url.searchParams.set("utm_campaign", params.campaignId);
    url.searchParams.set("utm_content", params.affiliateId);
    url.searchParams.set("ref", params.slug);
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}
