"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useClipboard } from "@/hooks/use-clipboard";
import { useToast } from "@/components/toast";
import { CopyButton } from "@/components/copy-button";
import { formatDate, formatNumber } from "@/lib/format";

export type LinkRow = {
  id: string;
  slug: string;
  url: string;
  campaignId: string;
  campaignName: string;
  productName: string;
  clicks: number;
  createdAt: string | Date;
};

export type CampaignOption = {
  id: string;
  name: string;
  productId: string;
  productName: string;
};

type SortKey = "newest" | "oldest" | "clicks";

/**
 * Tracking-link workspace: generator (campaign → product), search,
 * campaign filter, sorting, copy + auto-copy on creation.
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
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  async function generate() {
    if (!campaignId) return;
    setGenerating(true);
    try {
      const data = await api.post<{ url: string; reused: boolean }>("/api/tracking/generate", {
        campaignId,
        productId: selectedCampaign?.productId,
      });
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
      setGenerating(false);
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = links;
    if (filterCampaign !== "all") rows = rows.filter((l) => l.campaignId === filterCampaign);
    if (term) {
      rows = rows.filter(
        (l) =>
          l.slug.toLowerCase().includes(term) ||
          l.url.toLowerCase().includes(term) ||
          l.campaignName.toLowerCase().includes(term) ||
          l.productName.toLowerCase().includes(term),
      );
    }
    return [...rows].sort((a, b) => {
      if (sort === "clicks") return b.clicks - a.clicks;
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "newest" ? diff : -diff;
    });
  }, [links, search, filterCampaign, sort]);

  return (
    <div className="space-y-6">
      {/* Generator */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Generate a link</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You need an active campaign assignment before generating links.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
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
            <div>
              <label htmlFor="gen-product" className="mb-1.5 block text-xs font-medium text-zinc-400">
                Product
              </label>
              {/* One product per campaign in V1 — selection follows the campaign */}
              <select id="gen-product" className="input" value={selectedCampaign?.productId ?? ""} disabled>
                <option value={selectedCampaign?.productId ?? ""}>
                  {selectedCampaign?.productName ?? "—"}
                </option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn-primary w-full"
                onClick={generate}
                disabled={generating || !campaignId}
              >
                {generating ? "Generating…" : "Generate & copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          className="input max-w-xs"
          placeholder="Search links, campaigns, products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tracking links"
        />
        <select
          className="input w-auto"
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
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
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort links"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="clicks">Most clicks</option>
        </select>
        <span className="ml-auto text-xs text-zinc-500">
          {visible.length} of {links.length} links
        </span>
      </div>

      {/* Table */}
      <section className="card">
        {links.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-500">
            No tracking links yet — generate your first one above.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-500">
            Nothing matches your search or filters.
          </p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Link</th>
                <th>Campaign</th>
                <th>Product</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">Created</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {visible.map((link) => (
                <tr key={link.id}>
                  <td>
                    <code className="text-xs text-ember-text">{link.url}</code>
                  </td>
                  <td className="text-zinc-400">{link.campaignName}</td>
                  <td className="text-zinc-400">{link.productName}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatNumber(link.clicks)}
                  </td>
                  <td className="text-right text-xs text-zinc-500">{formatDate(link.createdAt)}</td>
                  <td className="text-right">
                    <CopyButton text={link.url} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
