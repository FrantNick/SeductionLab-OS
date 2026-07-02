"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type SubmitResponse = {
  initialScrape: "ok" | "failed" | "disabled";
  scrapeError: string | null;
};

export type UnusedLink = {
  id: string;
  slug: string;
  url: string;
  campaignId: string;
  createdAt: string | Date;
};

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

/**
 * Thread submission: campaign + tweet URL + the tracking link the thread
 * promotes. Only unused links (no thread bound yet) from the selected
 * campaign are offered; submitting binds the link permanently, which is
 * what makes per-thread attribution exact.
 */
export function ThreadSubmitForm({
  campaigns,
  unusedLinks,
}: {
  campaigns: { id: string; name: string }[];
  unusedLinks: UnusedLink[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [trackingLinkId, setTrackingLinkId] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const validationError = useMemo(() => validateTweetUrl(twitterUrl), [twitterUrl]);
  const campaignLinks = useMemo(
    () => unusedLinks.filter((l) => l.campaignId === campaignId),
    [unusedLinks, campaignId],
  );
  // keep the selection valid when the campaign changes
  const selectedLinkId = campaignLinks.some((l) => l.id === trackingLinkId)
    ? trackingLinkId
    : (campaignLinks[0]?.id ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) {
      setTouched(true);
      return;
    }
    if (!selectedLinkId) return;
    setLoading(true);
    try {
      const data = await api.post<SubmitResponse>("/api/threads", {
        campaignId,
        twitterUrl,
        trackingLinkId: selectedLinkId,
      });
      setTwitterUrl("");
      setTrackingLinkId("");
      setTouched(false);
      if (data.initialScrape === "ok") {
        toast({ kind: "success", title: "Thread submitted", description: "Metrics scraped and link bound." });
      } else if (data.initialScrape === "failed") {
        toast({
          kind: "warning",
          title: "Thread submitted — scrape failed",
          description: data.scrapeError ?? "The 6-hour refresh job will retry.",
          durationMs: 8000,
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
      <div className="grid gap-4 sm:grid-cols-2">
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
          <label htmlFor="thread-link" className="mb-1.5 block text-xs font-medium text-zinc-400">
            Tracking link (the one inside this thread)
          </label>
          {campaignLinks.length === 0 ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              No unused links in this campaign —{" "}
              <Link href="/dashboard/links" className="underline underline-offset-2">
                create one first
              </Link>
              , post it in your thread, then submit here.
            </p>
          ) : (
            <select
              id="thread-link"
              className="input"
              value={selectedLinkId}
              onChange={(e) => setTrackingLinkId(e.target.value)}
            >
              {campaignLinks.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.slug} — {l.url}
                </option>
              ))}
            </select>
          )}
        </div>
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
        disabled={loading || !campaignId || !selectedLinkId || (touched && !!validationError)}
      >
        {loading ? "Submitting…" : "Submit thread"}
      </button>
    </form>
  );
}
