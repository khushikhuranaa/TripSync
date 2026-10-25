"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useDemoStore } from "@/lib/demo-store";

const pageLabels: Record<string, string> = {
  dashboard: "Dashboard",
  trips: "My trips",
  invitations: "Invitations",
  profile: "Profile",
  admin: "Admin",
};

const tripSectionLabels: Record<string, string> = {
  itinerary: "Itinerary",
  "ai-planner": "AI planner",
  expenses: "Expenses",
  polls: "Polls",
  packing: "Packing list",
  notes: "Notes",
};

export function AppBreadcrumb() {
  const pathname = usePathname();
  const { state } = useDemoStore();
  const parts = pathname.split("/").filter(Boolean); // preview / trips / goa / itinerary
  const section = parts[1] ?? "dashboard";
  const trip =
    section === "trips" && parts[2]
      ? state.trips.find((entry) => entry.id === parts[2])
      : undefined;
  const tripSection = parts[3] ? tripSectionLabels[parts[3]] : undefined;

  const crumbs: { label: string; href?: string }[] = [
    { label: "Workspace", href: "/preview/dashboard" },
  ];

  if (trip) {
    crumbs.push({ label: "My trips", href: "/preview/trips" });
    crumbs.push({ label: trip.name, href: `/preview/trips/${trip.id}` });
    if (tripSection) crumbs.push({ label: tripSection });
  } else {
    crumbs.push({ label: pageLabels[section] ?? "Workspace" });
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-ink-400"
                />
              )}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="truncate text-ink-500 transition-colors hover:text-forest-800"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className="truncate font-medium text-forest-900"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
