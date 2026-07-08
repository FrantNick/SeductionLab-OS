"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useClipboard } from "@/hooks/use-clipboard";
import { useToast } from "@/components/toast";
import { CopyButton } from "@/components/copy-button";
import { ConfirmAction } from "@/components/confirm-dialog";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

export type LinkRow = {
  id: string;
  slug: string;
  url: string;
  campaignId: string;
  campaignName: string;
  createdAt: string | Date;
  clicks: number;
  conversions: number;
  revenue: number;
  /** planned thread name captured at creation (shown until a thread binds) */
  plannedName: string | null;
  thread: { id: string; label: string } | null;
};

export type CampaignOption = {
  id: string;
  name: string;
};

type SortKey = "newest" | "oldest" | "clicks" | "revenue";
type StatusFilter = "all" | "linked" | "unused";

const PAGE_SIZE = 15;

/**
 * Tracking-link workspace. Links are per-thread: create as many as you
 * need inside a campaign (one for each thread you plan to post), copy the
 * URL into the thread, then bind it when submitting the thread.
 */
export function TrackingLinksManager({
  links,
  campaigns,
}: {
  links: LinkRow[];
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { copy } = useClipboard();

  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [threadName, setThreadName] = useState("");
  const [threadDescription, setThreadDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  async function generate() {
    if (!campaignId) return;
    setGenerating(true);
    try {
      const data = await api.post<{ url: string }>("/api/tracking/generate", {
        campaignId,
        threadName: threadName.trim() || undefined,
        threadDescription: threadDescription.trim() || undefined,
      });
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
      setGenerating(false);
    }
  }

  async function remove(link: LinkRow) {
    try {
      await api.delete(`/api/tracking/${link.id}`);
      toast({ kind: "success", title: `Deleted ${link.slug}` });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Could not delete link", description: errorMessage(err) });
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = links;
    if (filterCampaign !== "all") rows = rows.filter((l) => l.campaignId === filterCampaign);
    if (filterStatus === "linked") rows = rows.filter((l) => l.thread !== null);
    if (filterStatus === "unused") rows = rows.filter((l) => l.thread === null);
    if (term) {
      rows = rows.filter(
        (l) =>
          l.slug.toLowerCase().includes(term) ||
          l.url.toLowerCase().includes(term) ||
          l.campaignName.toLowerCase().includes(term) ||
          (l.plannedName?.toLowerCase().includes(term) ?? false) ||
          (l.thread?.label.toLowerCase().includes(term) ?? false),
      );
    }
    return [...rows].sort((a, b) => {
      if (sort === "clicks") return b.clicks - a.clicks;
      if (sort === "revenue") return b.revenue - a.revenue;
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "newest" ? diff : -diff;
    });
  }, [links, search, filterCampaign, filterStatus, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // any filter change snaps back to page 1 via these wrapped setters
  const withReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };
  const setSearchR = withReset(setSearch);
  const setFilterCampaignR = withReset(setFilterCampaign);
  const setFilterStatusR = withReset(setFilterStatus);
  const setSortR = withReset(setSort);

  return (
    <div className="space-y-6">
      {/* Create */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-200">Create a link</h2>
        <p className="mb-4 text-xs text-zinc-500">
          One link per thread: create it first, paste it into the thread you post, then bind it
          when you submit the thread under Threads.
        </p>
        {campaigns.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You need an active campaign assignment before creating links.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-56">
                <label htmlFor="gen-campaign" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Campaign
                </label>
                <select
                  id="gen-campaign"
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
              <div className="min-w-64 flex-1">
                <label htmlFor="gen-name" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Thread name (optional)
                </label>
                <input
                  id="gen-name"
                  className="input"
                  placeholder="e.g. Pain exaggeration hook v2"
                  maxLength={120}
                  value={threadName}
                  onChange={(e) => setThreadName(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={generate}
                disabled={generating || !campaignId}
              >
                {generating ? "Creating…" : "Create & copy"}
              </button>
            </div>
            <div>
              <label htmlFor="gen-desc" className="mb-1.5 block text-xs font-medium text-zinc-400">
                Description (optional)
              </label>
              <textarea
                id="gen-desc"
                className="input min-h-16"
                placeholder="Notes about the thread you plan to post with this link — carried onto the thread at submission."
                maxLength={2000}
                value={threadDescription}
                onChange={(e) => setThreadDescription(e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          className="input max-w-xs"
          placeholder="Search slug, campaign, thread…"
          value={search}
          onChange={(e) => setSearchR(e.target.value)}
          aria-label="Search tracking links"
        />
        <select
          className="input w-auto"
          value={filterCampaign}
          onChange={(e) => setFilterCampaignR(e.target.value)}
          aria-label="Filter by campaign"
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filterStatus}
          onChange={(e) => setFilterStatusR(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">Linked & unused</option>
          <option value="linked">Linked to a thread</option>
          <option value="unused">Unused</option>
        </select>
        <select
          className="input w-auto"
          value={sort}
          onChange={(e) => setSortR(e.target.value as SortKey)}
          aria-label="Sort links"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="clicks">Most clicks</option>
          <option value="revenue">Most revenue</option>
        </select>
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} of {links.length} links
        </span>
      </div>

      {/* Table */}
      <section className="card">
        {links.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-zinc-400">No tracking links yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-zinc-500">
              Create one above for your next thread. Each thread gets its own link, so every
              click and sale is attributed to exactly the thread that earned it.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-500">
            Nothing matches your search or filters.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Link</th>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Thread</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">Conv.</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Created</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {visible.map((link) => {
                  const deletable = link.thread === null && link.clicks === 0;
                  return (
                    <tr key={link.id}>
                      <td>
                        <code className="text-xs text-ember-text">{link.slug}</code>
                        {!link.thread && link.plannedName && (
                          <p className="mt-0.5 max-w-40 truncate text-xs text-zinc-500">
                            {link.plannedName}
                          </p>
                        )}
                      </td>
                      <td className="text-zinc-400">{link.campaignName}</td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                            link.thread
                              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                              : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30"
                          }`}
                        >
                          {link.thread ? "linked" : "unused"}
                        </span>
                      </td>
                      <td className="max-w-44">
                        {link.thread ? (
                          <Link
                            href={`/dashboard/threads/${link.thread.id}`}
                            className="block truncate text-xs text-ember-text underline-offset-2 hover:underline"
                          >
                            {link.thread.label}
                          </Link>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="num text-right font-medium text-zinc-200">
                        {formatNumber(link.clicks)}
                      </td>
                      <td className="num text-right">{formatNumber(link.conversions)}</td>
                      <td className="num text-right">{formatMoney(link.revenue)}</td>
                      <td className="text-right text-xs text-zinc-500">
                        {formatDate(link.createdAt)}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <CopyButton text={link.url} />
                          {deletable && (
                            <ConfirmAction
                              action={() => remove(link)}
                              title={`Delete ${link.slug}?`}
                              description="This link was never used — no thread and no clicks — so nothing is lost."
                              confirmLabel="Delete"
                            >
                              <span className="btn-ghost text-red-400">Delete</span>
                            </ConfirmAction>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-ink-800 px-5 py-2.5">
                <span className="text-[11px] text-zinc-500">
                  Page {currentPage} of {pages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={currentPage >= pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
