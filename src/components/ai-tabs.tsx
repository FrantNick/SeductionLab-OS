"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/ai", label: "Providers & models", exact: true },
  { href: "/admin/ai/prompts", label: "Prompts" },
  { href: "/admin/ai/knowledge", label: "Knowledge base" },
  { href: "/admin/ai/chat", label: "Chat" },
];

/** Sub-navigation shared by every page in the admin AI section. */
export function AiTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-ink-700">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-ember font-medium text-ember-text"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
