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
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-ink-2">{subtitle}</p>}
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
    <section className={`card overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b-brutal border-line px-5 py-3.5">
          {title && (
            <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-ink">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {/* unpadded cards hold tables — let them scroll sideways on phones */}
      <div className={padded ? "p-5" : "overflow-x-auto"}>{children}</div>
    </section>
  );
}

/**
 * Stat tile: small Archivo uppercase label + big Anton number, on a
 * bordered card with a hard shadow — like a cut-out from a magazine.
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
      <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
        {label}
      </p>
      <p className="mt-1.5 font-display text-3xl uppercase leading-none text-ink">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/** Pill badges: active = green, paused/banned = rust, draft/neutral = soft. */
const badgeStyles: Record<string, string> = {
  ACTIVE: "bg-pos-tint text-pos",
  RUNNING: "bg-pos-tint text-pos",
  ok: "bg-pos-tint text-pos",
  healthy: "bg-pos-tint text-pos",
  PAUSED: "bg-rust-tint text-rust",
  BANNED: "bg-rust-tint text-rust",
  REMOVED: "bg-rust-tint text-rust",
  CANCELLED: "bg-rust-tint text-rust",
  error: "bg-rust-tint text-rust",
  unhealthy: "bg-rust-tint text-rust",
  ADMIN: "bg-rust-tint text-rust",
  DRAFT: "bg-ink-800 text-ink-2",
  COMPLETED: "bg-ink-800 text-ink-2",
  AFFILIATE: "bg-ink-800 text-ink-2",
  unconfigured: "bg-ink-800 text-ink-2",
  unchecked: "bg-ink-800 text-ink-2",
};

export function Badge({ value }: { value: string }) {
  const style = badgeStyles[value] ?? badgeStyles.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full border-brutal border-line px-2.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] ${style}`}
    >
      {value.toLowerCase()}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-heading text-sm font-semibold text-ink-2">{title}</p>
      {hint && <p className="mt-1.5 max-w-md text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/** Shown in place of a page whose feature flag is switched off. */
export function FeatureDisabledNotice({ feature }: { feature: string }) {
  return (
    <div className="card">
      <EmptyState
        title={`${feature} is disabled`}
        hint="An admin can enable this feature under Settings → Feature flags."
      />
      <div className="pb-6 text-center">
        <Link href="/admin/settings" className="btn-secondary">
          Open settings
        </Link>
      </div>
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-rust underline decoration-rust/40 underline-offset-2 hover:text-rust-bright hover:decoration-rust-bright"
    >
      {children}
    </a>
  );
}

export function InternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-rust underline decoration-rust/40 underline-offset-2 hover:text-rust-bright hover:decoration-rust-bright"
    >
      {children}
    </Link>
  );
}
