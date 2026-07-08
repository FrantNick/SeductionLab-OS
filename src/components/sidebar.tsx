"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export type NavItem = { href: string; label: string; exact?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

export function Sidebar({
  sections,
  userLabel,
  roleLabel,
  appName = "Seduction Lab",
}: {
  sections: NavSection[];
  userLabel: string;
  roleLabel: string;
  appName?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r-brutal border-line bg-paper">
      <div className="flex items-center gap-3 border-b-brutal border-line px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-brutal border-brutal border-line bg-rust font-display text-sm uppercase text-white shadow-hard-sm">
          {appName
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div>
          <p className="font-display text-base uppercase leading-tight tracking-wide text-ink">
            {appName}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">OS · v2</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className="space-y-1">
            {section.title && (
              <p className="px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-brutal-lg px-3 py-2 font-heading text-sm transition-colors ${
                    active
                      ? "border-brutal border-line bg-rust-tint font-bold text-rust"
                      : "border-brutal border-transparent font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t-brutal border-line px-5 py-4">
        <p className="truncate text-xs font-semibold text-ink">{userLabel}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">{roleLabel}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-secondary mt-3 w-full !py-1.5 text-xs"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
