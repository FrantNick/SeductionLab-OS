"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type SubmitResponse = { initialScrape: "ok" | "failed" | "disabled" };

/** Client-side mirror of the server's tweet-permalink validation. */
function validateTweetUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!["twitter.com", "x.com", "mobile.twitter.com", "mobile.x.com"].includes(host)) {
      return "URL must be on x.com or twitter.com";
    }
    if (!/\/status(?:es)?\/\d{5,25}/.test(url.pathname)) {
      return "URL must be a tweet permalink (…/status/123…)";
    }
    return null;
  } catch {
    return "Enter a full URL, starting with https://";
  }
}

export function ThreadSubmitForm({
  campaigns,
}: {
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const validationError = useMemo(() => validateTweetUrl(twitterUrl), [twitterUrl]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) {
      setTouched(true);
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<SubmitResponse>("/api/threads", { campaignId, twitterUrl });
      setTwitterUrl("");
      setTouched(false);
      if (data.initialScrape === "ok") {
        toast({ kind: "success", title: "Thread submitted", description: "Metrics scraped." });
      } else if (data.initialScrape === "failed") {
        toast({
          kind: "warning",
          title: "Thread submitted",
          description: "Initial scrape failed; the 6-hour job will retry.",
        });
      } else {
        toast({
          kind: "success",
          title: "Thread submitted",
          description: "Metrics will populate once Apify is configured.",
        });
      }
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Submission failed", description: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        You have no active campaign assignments yet — ask an admin to assign you to a campaign.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="thread-campaign" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Campaign
        </label>
        <select
          id="thread-campaign"
          className="input"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="thread-url" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Thread URL
        </label>
        <input
          id="thread-url"
          className="input"
          type="url"
          required
          placeholder="https://x.com/yourhandle/status/1234567890"
          value={twitterUrl}
          onChange={(e) => setTwitterUrl(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && !!validationError}
        />
        {touched && validationError && (
          <p className="mt-1.5 text-xs text-red-400">{validationError}</p>
        )}
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={loading || !campaignId || (touched && !!validationError)}
      >
        {loading ? "Submitting…" : "Submit thread"}
      </button>
    </form>
  );
}
