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

import { useTheme } from "@/components/theme";

/**
 * Chart tokens per theme — both series palettes validated with the
 * dataviz palette checker against their card surface (#FBF9F3 light,
 * #211B16 dark): lightness band, chroma floor, CVD ΔE and contrast all
 * PASS. Slot order is fixed; series are assigned in sequence. Rust
 * leads; the ink of the theme draws the baseline; the grid stays
 * recessive in line-soft.
 */
const THEMES = {
  light: {
    series: ["#C75230", "#3172BE", "#1F8A55", "#8A4FA8"],
    grid: "#D8D1C2",
    axisText: "#8A8075",
    baseline: "#1C1714",
    surface: "#FBF9F3",
    tooltipBg: "#FBF9F3",
    tooltipText: "#1C1714",
    cursorFill: "#F6E6DD",
    legendText: "#4A423B",
  },
  dark: {
    series: ["#E0532C", "#5B96D6", "#3FA976", "#A97BC8"],
    grid: "#42382F",
    axisText: "#9C9186",
    baseline: "#F4F0E7",
    surface: "#211B16",
    tooltipBg: "#211B16",
    tooltipText: "#F4F0E7",
    cursorFill: "#3C221A",
    legendText: "#C9C2B4",
  },
} as const;

function useChartTokens() {
  const { dark } = useTheme();
  const t = dark ? THEMES.dark : THEMES.light;
  return {
    SERIES: t.series,
    GRID: t.grid,
    SURFACE: t.surface,
    legendText: t.legendText,
    axisProps: {
      stroke: t.baseline,
      tick: { fill: t.axisText, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      tickLine: false as const,
      axisLine: { stroke: t.baseline, strokeWidth: 1.5 },
    },
    tooltipStyle: {
      contentStyle: {
        background: t.tooltipBg,
        border: `1.75px solid ${t.baseline}`,
        borderRadius: 8,
        fontSize: 12,
        color: t.tooltipText,
        boxShadow: dark ? "4px 4px 0 #080605" : "4px 4px 0 #1C1714",
      },
      labelStyle: { color: t.axisText, fontSize: 11 },
      cursor: { stroke: t.baseline, strokeWidth: 1 },
    },
    cursorFill: t.cursorFill,
  };
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Generic single-series time chart (clicks, views, revenue…).
 * One series → no legend; the card title names it.
 */
export function TimeSeriesChart({
  data,
  format = "number",
}: {
  data: { date: string; value: number }[];
  format?: "number" | "money";
}) {
  const { SERIES, GRID, SURFACE, axisProps, tooltipStyle, cursorFill, legendText } = useChartTokens();

  const fmt = (v: number) => (format === "money" ? `$${compact(v)}` : compact(v));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            {...axisProps}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis {...axisProps} tickFormatter={fmt} width={52} />
          <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} />
          <Area
            type="monotone"
            dataKey="value"
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

/** Single-series clicks-over-time. One series → no legend; title names it. */
export function ClicksAreaChart({ data }: { data: { date: string; clicks: number }[] }) {
  const { SERIES, GRID, SURFACE, axisProps, tooltipStyle, cursorFill, legendText } = useChartTokens();

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
  const { SERIES, GRID, SURFACE, axisProps, tooltipStyle, cursorFill, legendText } = useChartTokens();

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
          <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: cursorFill }} />
          <Bar dataKey="value" fill={SERIES[0]} maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series views-over-time for a thread's metric snapshots. */
export function ViewsLineChart({ data }: { data: { label: string; views: number }[] }) {
  const { SERIES, GRID, SURFACE, axisProps, tooltipStyle, cursorFill, legendText } = useChartTokens();

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
  const { SERIES, GRID, SURFACE, axisProps, tooltipStyle, cursorFill, legendText } = useChartTokens();

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
            formatter={(value: string) => <span style={{ color: legendText }}>{value}</span>}
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
