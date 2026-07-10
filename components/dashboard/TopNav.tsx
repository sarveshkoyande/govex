"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavDomain {
  id: string;
  name: string;
  slug: string;
  trackerCount: number;
  /** Set when the domain has exactly one tracker — the tab links straight to it. */
  soloTrackerId?: string;
}

export default function TopNav({ domains }: { domains: NavDomain[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeDomain = searchParams.get("domain");
  const onHome = pathname === "/";

  const items = [
    { key: "home", label: "Home", href: "/", active: onHome && !activeDomain, hasData: true },
    ...domains.map((d) => {
      const href = d.soloTrackerId ? `/trackers/${d.soloTrackerId}` : `/?domain=${d.slug}`;
      const active = d.soloTrackerId
        ? pathname === `/trackers/${d.soloTrackerId}`
        : onHome && activeDomain === d.slug;
      return { key: d.slug, label: d.name, href, active, hasData: d.trackerCount > 0 };
    }),
  ];

  return (
    <nav
      aria-label="Dashboard sections"
      className="scrollbar-none flex flex-shrink-0 items-center overflow-x-auto border-b"
      style={{
        background: "linear-gradient(90deg, oklch(0.36 0.20 260) 0%, oklch(0.24 0.16 268) 100%)",
        borderColor: "oklch(1 0 0 / 0.12)",
      }}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative h-10 flex-shrink-0 whitespace-nowrap px-4 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
            item.active ? "text-white" : "text-white/55 hover:bg-white/6 hover:text-white/90",
          )}
          style={item.active ? { background: "oklch(1 0 0 / 0.12)" } : undefined}
        >
          <span className="flex items-center gap-1.5">
            {item.hasData && (
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" aria-label="Has data" />
            )}
            {item.label}
          </span>
          {item.active && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
              style={{ background: "oklch(0.80 0.12 220)" }}
              aria-hidden="true"
            />
          )}
        </Link>
      ))}
    </nav>
  );
}
