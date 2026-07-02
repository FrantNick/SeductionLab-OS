import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>}
          {action}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

/**
 * Stat tile: label (sentence case) + compact value in semibold sans.
 * Values use proportional figures on purpose — tabular-nums is reserved
 * for table columns and axis ticks.
 */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  DRAFT: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30",
  PAUSED: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  COMPLETED: "bg-sky-500/10 text-sky-400 ring-sky-500/30",
  BANNED: "bg-red-500/10 text-red-400 ring-red-500/30",
  REMOVED: "bg-red-500/10 text-red-400 ring-red-500/30",
  ADMIN: "bg-ember-soft text-ember-text ring-ember/30",
  AFFILIATE: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30",
};

export function Badge({ value }: { value: string }) {
  const style = badgeStyles[value] ?? badgeStyles.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style}`}
    >
      {value.toLowerCase()}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ember-text underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

export function InternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-ember-text underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
