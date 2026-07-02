import type { LeaderboardRow } from "@/lib/leaderboard";
import { formatMoney, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { EmptyState } from "@/components/ui";

/**
 * Shared leaderboard renderer: rank movement, top-3 medal styling and
 * avatar initials. Used by the affiliate dashboard and admin pages.
 */

const MEDALS = ["🥇", "🥈", "🥉"];

function Movement({ movement, isNew }: { movement: number; isNew: boolean }) {
  if (isNew) return <span className="text-[11px] font-medium text-sky-400">new</span>;
  if (movement > 0)
    return <span className="text-[11px] font-medium text-emerald-400">▲ {movement}</span>;
  if (movement < 0)
    return <span className="text-[11px] font-medium text-red-400">▼ {Math.abs(movement)}</span>;
  return <span className="text-[11px] text-zinc-600">—</span>;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- remote avatars, host list unknown
    return <img src={url} alt="" className="h-7 w-7 rounded-full object-cover" />;
  }
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-700 text-[10px] font-semibold text-zinc-300">
      {initials}
    </span>
  );
}

export function LeaderboardTable({
  rows,
  highlightAffiliateId,
}: {
  rows: LeaderboardRow[];
  highlightAffiliateId?: string | null;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Leaderboard has not been computed yet" />;
  }

  return (
    <>
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-20">Rank</th>
            <th>Affiliate</th>
            <th className="text-right">Threads</th>
            <th className="text-right">Views</th>
            <th className="text-right">Clicks</th>
            <th className="text-right">CTR</th>
            <th className="text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isTop3 = row.rank <= 3;
            const highlighted = row.affiliateId === highlightAffiliateId;
            return (
              <tr key={row.affiliateId} className={highlighted ? "bg-ember-soft" : ""}>
                <td>
                  <div className="flex items-center gap-2">
                    <span
                      className={`num font-semibold ${isTop3 ? "text-ember-text" : "text-zinc-400"}`}
                    >
                      {MEDALS[row.rank - 1] ?? `#${row.rank}`}
                    </span>
                    <Movement movement={row.movement} isNew={row.previousRank == null} />
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.displayName} url={row.avatarUrl} />
                    <span className={`font-medium ${isTop3 ? "text-white" : "text-zinc-200"}`}>
                      {row.displayName}
                    </span>
                    {highlighted && <span className="text-xs text-ember-text">you</span>}
                    {row.rank === 1 && (
                      <span className="rounded-full bg-ember-soft px-2 py-0.5 text-[10px] font-medium text-ember-text ring-1 ring-inset ring-ember/30">
                        top earner
                      </span>
                    )}
                  </div>
                </td>
                <td className="num text-right">{formatNumber(row.threads)}</td>
                <td className="num text-right">{formatNumber(row.views)}</td>
                <td className="num text-right">{formatNumber(row.clicks)}</td>
                <td className="num text-right">{formatPercent(row.ctr)}</td>
                <td className="num text-right font-medium text-zinc-200">
                  {formatMoney(row.revenue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-ink-800 px-5 py-2.5 text-[11px] text-zinc-500">
        Recomputed every 10 minutes · last update {timeAgo(rows[0]?.computedAt)}
      </p>
    </>
  );
}
