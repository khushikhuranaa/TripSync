"use client";

import { useMemo, useState } from "react";
import { Map, Search, SlidersHorizontal, X } from "lucide-react";
import { TripRow } from "@/components/trips/trip-row";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { CreateTripDialog } from "@/components/app-shell/create-trip-dialog";
import { cn } from "@/lib/cn";
import type { Trip, TripStatus } from "@/lib/types";

export interface TripEntry {
  trip: Trip;
  status: TripStatus;
}

type Filter = "all" | TripStatus;
type Sort =
  | "soonest"
  | "latest"
  | "updated"
  | "created"
  | "destination"
  | "name";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All trips" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Happening now" },
  { value: "completed", label: "Completed" },
];

/** How many rows render at once; the rest are one click away. */
const PAGE_SIZE = 20;

export function TripsView({
  entries,
  currentUserId,
}: {
  entries: TripEntry[];
  currentUserId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("soonest");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const counts = useMemo(() => {
    return {
      all: entries.length,
      upcoming: entries.filter((entry) => entry.status === "upcoming").length,
      ongoing: entries.filter((entry) => entry.status === "ongoing").length,
      completed: entries.filter((entry) => entry.status === "completed").length,
    };
  }, [entries]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      const matchesFilter = filter === "all" || entry.status === filter;
      const matchesQuery =
        !needle ||
        entry.trip.name.toLowerCase().includes(needle) ||
        entry.trip.destination.toLowerCase().includes(needle) ||
        entry.trip.region.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.trip.name.localeCompare(b.trip.name);
      if (sort === "destination")
        return (
          a.trip.destination.localeCompare(b.trip.destination) ||
          a.trip.name.localeCompare(b.trip.name)
        );
      if (sort === "updated")
        return (
          (b.trip.updatedMs ?? b.trip.createdMs ?? 0) -
            (a.trip.updatedMs ?? a.trip.createdMs ?? 0) ||
          b.trip.startDate.localeCompare(a.trip.startDate)
        );
      if (sort === "created")
        return (
          (b.trip.createdMs ?? 0) - (a.trip.createdMs ?? 0) ||
          b.trip.createdAt.localeCompare(a.trip.createdAt) ||
          b.trip.startDate.localeCompare(a.trip.startDate)
        );
      if (sort === "latest") return b.trip.startDate.localeCompare(a.trip.startDate);
      return a.trip.startDate.localeCompare(b.trip.startDate);
    });
  }, [entries, filter, query, sort]);

  function clearFilters() {
    setFilter("all");
    setQuery("");
    setSort("soonest");
    setLimit(PAGE_SIZE);
  }

  // A long list stays fast to scan: only the first page renders, and the count
  // below always states how many trips exist in total.
  const visible = results.slice(0, limit);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Map}
        title="No trips in this workspace yet"
        description="Create a trip with a destination and dates, or accept an invitation. Your itinerary, expenses and shared lists will live inside it."
        action={<CreateTripDialog triggerLabel="Create your first trip" />}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter trips by status"
        >
          {filters.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-medium transition-colors",
                  active
                    ? "border-forest-900 bg-forest-900 text-paper-50"
                    : "border-line bg-card text-ink-500 hover:border-line-strong hover:text-forest-800",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "tabular-nums",
                    active ? "text-paper-200/70" : "text-ink-400",
                  )}
                >
                  {counts[item.value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="trip-search" className="sr-only">
            Search trips
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
          />
          <input
            id="trip-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search trips or destinations"
            className="h-9 w-full rounded-lg border border-line-strong bg-card pl-9 pr-9 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 hover:bg-paper-100 hover:text-forest-800"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-1.5 text-[11.5px] text-ink-500">
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          Showing {results.length} of {entries.length} trips
          {query ? ` for “${query}”` : ""}
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="trip-sort" className="text-[11px] text-ink-400">
            Sort
          </label>
          <select
            id="trip-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="h-8 rounded-lg border border-line-strong bg-card px-2 text-[11.5px] text-ink-700 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
          >
            <option value="soonest">Soonest first</option>
            <option value="latest">Latest first</option>
            <option value="created">Recently added</option>
            <option value="updated">Recently updated</option>
            <option value="destination">Destination A–Z</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {results.length > 0 ? (
        <div className="rounded-xl border border-line bg-card px-4 shadow-soft sm:px-5">
          {visible.map((entry) => (
            <TripRow
              key={entry.trip.id}
              trip={entry.trip}
              currentUserId={currentUserId}
              status={entry.status}
            />
          ))}
          {visible.length < results.length && (
            <div className="flex flex-col items-center gap-1 border-t border-line py-4 sm:flex-row sm:justify-between">
              <p className="text-[11.5px] text-ink-500">
                Showing {visible.length} of {results.length} trips
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLimit(results.length)}
              >
                Show all {results.length} trips
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No trips match these filters"
          description="Try a different status, search for a destination, or clear the filters to see every trip."
          action={
            <Button variant="secondary" size="md" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}
    </div>
  );
}
