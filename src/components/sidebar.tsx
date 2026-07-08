"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme";

export type NavItem = { href: string; label: string; exact?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

/**
 * Role-based navigation. Desktop (lg+): fixed 240px rail. Phones/tablets:
 * an off-canvas drawer behind a hamburger top bar — most users are on
 * phones, so the drawer closes on navigation and behind a scrim.
 */
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
  const [open, setOpen] = useState(false);

  // navigating (or resizing back to desktop) closes the drawer
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const initials = appName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b-brutal border-line bg-paper px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-brutal border-brutal border-line bg-card shadow-hard-sm"
        >
          <span className="h-[2px] w-4 bg-ink" />
          <span className="h-[2px] w-4 bg-ink" />
          <span className="h-[2px] w-4 bg-ink" />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-brutal border-brutal border-line bg-rust font-display text-xs uppercase text-white">
          {initials}
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-base uppercase tracking-wide text-ink">
          {appName}
        </span>
        <ThemeToggle compact />
      </header>

      {/* scrim behind the open drawer */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r-brutal border-line bg-paper transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-3 border-b-brutal border-line px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-brutal border-brutal border-line bg-rust font-display text-sm uppercase text-white shadow-hard-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base uppercase leading-tight tracking-wide text-ink">
              {appName}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">OS · v2</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="btn-ghost lg:hidden"
          >
            ✕
          </button>
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

        <div className="space-y-3 border-t-brutal border-line px-5 py-4">
          <div>
            <p className="truncate text-xs font-semibold text-ink">{userLabel}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
              {roleLabel}
            </p>
          </div>
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-secondary w-full !py-1.5 text-xs"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
