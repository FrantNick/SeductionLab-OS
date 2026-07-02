"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useClipboard } from "@/hooks/use-clipboard";
import { useToast } from "@/components/toast";
import { CopyButton } from "@/components/copy-button";

type GenerateResponse = { url: string; reused: boolean };

/**
 * Calls POST /api/tracking/generate for a campaign, auto-copies the
 * resulting /go/{slug} URL and shows it with a copy control.
 */
export function GenerateLinkButton({
  campaignId,
  existingUrl,
}: {
  campaignId: string;
  existingUrl?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { copy } = useClipboard();
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const data = await api.post<GenerateResponse>("/api/tracking/generate", { campaignId });
      setUrl(data.url);
      await copy(data.url);
      toast({
        kind: "success",
        title: data.reused ? "Existing link copied" : "Tracking link created",
        description: "The URL is on your clipboard.",
      });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Could not generate link", description: errorMessage(err) });
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
    <button type="button" className="btn-primary w-full" onClick={generate} disabled={loading}>
      {loading ? "Generating…" : "Generate tracking link"}
    </button>
  );
}
