"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useClipboard } from "@/hooks/use-clipboard";
import { useToast } from "@/components/toast";
import { CopyButton } from "@/components/copy-button";

type GenerateResponse = { url: string };

/**
 * Creates a NEW tracking link for the campaign on every click (links are
 * per-thread), auto-copies the /go/{slug} URL and keeps the latest one
 * visible with a copy control.
 */
export function GenerateLinkButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { copy } = useClipboard();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const data = await api.post<GenerateResponse>("/api/tracking/generate", { campaignId });
      setUrl(data.url);
      await copy(data.url);
      toast({
        kind: "success",
        title: "Tracking link created",
        description: "The URL is on your clipboard — paste it into your next thread.",
      });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Could not create link", description: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {url && (
        <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
          <code className="flex-1 truncate text-xs text-ember-text">{url}</code>
          <CopyButton text={url} />
        </div>
      )}
      <button type="button" className="btn-primary w-full" onClick={generate} disabled={loading}>
        {loading ? "Creating…" : url ? "Create another link" : "Create tracking link"}
      </button>
    </div>
  );
}
