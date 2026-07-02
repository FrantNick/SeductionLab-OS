"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Chart tokens — validated with the dataviz palette checker against the
 * dark card surface #17171A (lightness band, chroma floor, CVD ΔE, contrast
 * all PASS). Slot order is fixed; series are assigned in sequence.
 */
const SERIES = ["#d95926", "#3987e5", "#199e70", "#9085e9"];
const GRID = "#2c2c2a";
const AXIS_TEXT = "#898781";
const BASELINE = "#383835";
const SURFACE = "#17171A";

const axisProps = {
  stroke: BASELINE,
  tick: { fill: AXIS_TEXT, fontSize: 11 },
  tickLine: false as const,
  axisLine: { stroke: BASELINE },
};

const tooltipStyle = {
  contentStyle: {
    background: "#1E1E22",
    border: "1px solid #3A3A42",
    borderRadius: 8,
    fontSize: 12,
    color: "#e4e4e7",
  },
  labelStyle: { color: "#a1a1aa", fontSize: 11 },
  cursor: { stroke: BASELINE, strokeWidth: 1 },
};

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Single-series clicks-over-time. One series → no legend; title names it. */
export function ClicksAreaChart({ data }: { data: { date: string; clicks: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            {...axisProps}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis {...axisProps} allowDecimals={false} tickFormatter={compact} width={48} />
          <Tooltip {...tooltipStyle} />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke={SERIES[0]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={SERIES[0]}
            fillOpacity={0.1}
            activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Nominal categories (campaign names) → one series, one hue (slot 1),
 * thin bars with rounded data-ends and a square baseline.
 */
export function CategoryBarChart({
  data,
  format = "number",
}: {
  data: { name: string; value: number }[];
  format?: "number" | "percent" | "money";
}) {
  const fmt = (v: number) =>
    format === "percent"
      ? `${(v * 100).toFixed(2)}%`
      : format === "money"
        ? `$${compact(v)}`
        : compact(v);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="30%">
          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
          <XAxis dataKey="name" {...axisProps} interval={0} minTickGap={8} />
          <YAxis {...axisProps} tickFormatter={fmt} width={56} />
          <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: "#1E1E22" }} />
          <Bar dataKey="value" fill={SERIES[0]} maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series views-over-time for a thread's metric snapshots. */
export function ViewsLineChart({ data }: { data: { label: string; views: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} allowDecimals={false} tickFormatter={compact} width={56} />
          <Tooltip {...tooltipStyle} />
          <Line
            type="monotone"
            dataKey="views"
            stroke={SERIES[0]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const ENGAGEMENT_KEYS = [
  { key: "likes", label: "Likes" },
  { key: "replies", label: "Replies" },
  { key: "retweets", label: "Retweets" },
  { key: "quotes", label: "Quotes" },
] as const;

/** Four engagement series → legend always present, fixed slot order. */
export function EngagementLineChart({
  data,
}: {
  data: { label: string; likes: number; replies: number; retweets: number; quotes: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} allowDecimals={false} tickFormatter={compact} width={56} />
          <Tooltip {...tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="plainline"
            iconSize={12}
            formatter={(value: string) => <span style={{ color: "#c3c2b7" }}>{value}</span>}
          />
          {ENGAGEMENT_KEYS.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={SERIES[i]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
