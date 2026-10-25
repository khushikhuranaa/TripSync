"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  { label: "Overview", segment: "" },
  { label: "Itinerary", segment: "itinerary" },
  { label: "Expenses", segment: "expenses" },
  { label: "Polls", segment: "polls" },
  { label: "Packing list", segment: "packing" },
  { label: "Notes", segment: "notes" },
];

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/preview/trips/${tripId}`;

  return (
    <div className="border-b border-line">
      <nav
        aria-label="Trip sections"
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex w-max min-w-full items-center gap-1 sm:gap-2">
          {tabs.map((tab) => {
            const href = tab.segment ? `${base}/${tab.segment}` : base;
            const active = tab.segment
              ? pathname === href || pathname.startsWith(`${href}/`)
              : pathname === base;

            return (
              <li key={tab.label}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-11 items-center px-2.5 text-[13px] font-medium transition-colors sm:px-3",
                    active
                      ? "text-forest-900"
                      : "text-ink-500 hover:text-forest-800",
                  )}
                >
                  {tab.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-[2px] rounded-t-full bg-clay-500 sm:inset-x-3"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
