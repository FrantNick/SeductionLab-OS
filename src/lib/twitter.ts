/**
 * Extracts the numeric tweet/status id from a twitter.com or x.com URL.
 * Returns null if the URL is not a valid tweet permalink.
 */
export function parseTweetId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const validHosts = ["twitter.com", "x.com", "mobile.twitter.com", "mobile.x.com"];
  if (!validHosts.includes(host)) return null;

  // /{handle}/status/{id} or /i/web/status/{id}
  const match = url.pathname.match(/\/status(?:es)?\/(\d{5,25})/);
  return match ? match[1] : null;
}

/** Normalizes a tweet URL to the canonical https://x.com/... form. */
export function normalizeTweetUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}
