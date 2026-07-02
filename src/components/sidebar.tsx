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
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-ink-700 bg-ink-900">
      <div className="flex items-center gap-2.5 border-b border-ink-700 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember text-sm font-bold text-white">
          {appName
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">{appName}</p>
          <p className="text-[11px] leading-tight text-zinc-500">OS · v2</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className="space-y-0.5">
            {section.title && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
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
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-ember-soft font-medium text-ember-text"
                      : "text-zinc-400 hover:bg-ink-800 hover:text-zinc-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-700 px-5 py-4">
        <p className="truncate text-xs font-medium text-zinc-300">{userLabel}</p>
        <p className="text-[11px] text-zinc-500">{roleLabel}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 w-full rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-ink-800 hover:text-zinc-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
