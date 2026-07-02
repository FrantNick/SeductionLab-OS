"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

/** Triggers POST /api/apify/scrape-thread for one thread and refreshes. */
export function ScrapeButton({
  threadId,
  twitterUrl,
  compact = false,
}: {
  threadId: string;
  twitterUrl: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function scrape() {
    setLoading(true);
    try {
      await api.post("/api/apify/scrape-thread", { threadId, twitterUrl });
      toast({ kind: "success", title: "Metrics refreshed" });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Scrape failed", description: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={compact ? "btn-ghost" : "btn-secondary"}
      onClick={scrape}
      disabled={loading}
    >
      {loading ? "Scraping…" : compact ? "Refresh" : "Refresh metrics"}
    </button>
  );
}
