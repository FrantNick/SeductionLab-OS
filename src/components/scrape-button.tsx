"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Triggers POST /api/apify/scrape-thread for one thread and refreshes. */
export function ScrapeButton({ threadId, twitterUrl }: { threadId: string; twitterUrl: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scrape() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/apify/scrape-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, twitterUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-secondary" onClick={scrape} disabled={loading}>
        {loading ? "Scraping…" : "Refresh metrics"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
