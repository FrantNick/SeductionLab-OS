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
 * visible with a copy control. Optionally captures the planned thread's
 * name/notes, which transfer to the Thread when it is submitted.
 */
export function GenerateLinkButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { copy } = useClipboard();
  const [url, setUrl] = useState<string | null>(null);
  const [threadName, setThreadName] = useState("");
  const [threadDescription, setThreadDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const data = await api.post<GenerateResponse>("/api/tracking/generate", {
        campaignId,
        threadName: threadName.trim() || undefined,
        threadDescription: threadDescription.trim() || undefined,
      });
      setUrl(data.url);
      setThreadName("");
      setThreadDescription("");
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
      <details className="rounded-lg border border-ink-700 bg-ink-900">
        <summary className="cursor-pointer px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200">
          Thread name & notes (optional)
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <input
            className="input"
            placeholder="Thread name, e.g. Pain exaggeration hook v2"
            maxLength={120}
            value={threadName}
            onChange={(e) => setThreadName(e.target.value)}
            aria-label="Planned thread name"
          />
          <textarea
            className="input min-h-16"
            placeholder="Notes about this thread…"
            maxLength={2000}
            value={threadDescription}
            onChange={(e) => setThreadDescription(e.target.value)}
            aria-label="Planned thread description"
          />
          <p className="text-[11px] text-zinc-500">
            Carried onto the thread when you submit it with this link.
          </p>
        </div>
      </details>
      <button type="button" className="btn-primary w-full" onClick={generate} disabled={loading}>
        {loading ? "Creating…" : url ? "Create another link" : "Create tracking link"}
      </button>
    </div>
  );
}
