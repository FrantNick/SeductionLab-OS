"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/copy-button";

/**
 * Calls POST /api/tracking/generate for a campaign and shows the
 * resulting /go/{slug} URL with a copy control.
 */
export function GenerateLinkButton({
  campaignId,
  existingUrl,
}: {
  campaignId: string;
  existingUrl?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tracking/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate link");
      setUrl(data.url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link");
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
        <code className="flex-1 truncate text-xs text-ember-text">{url}</code>
        <CopyButton text={url} />
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn-primary w-full" onClick={generate} disabled={loading}>
        {loading ? "Generating…" : "Generate tracking link"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
