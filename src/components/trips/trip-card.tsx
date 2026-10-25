"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge, TripStatusBadge } from "@/components/ui/badge";
import { useDemoStore } from "@/lib/demo-store";
import {
  formatCount,
  formatCurrency,
  formatDateRange,
  tripStatus,
} from "@/lib/format";
import type { Trip } from "@/lib/types";

export function TripCard({ trip }: { trip: Trip }) {
  const { state } = useDemoStore();
  const status = tripStatus(trip);
  const activityCount = state.itinerary.filter(
    (item) => item.tripId === trip.id,
  ).length;
  const travellers = trip.travellerCount ?? trip.members.length;

  return (
    <Link
      href={`/preview/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-soft transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-lift"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-paper-200">
        <Image
          src={trip.coverImage}
          alt={trip.coverAlt}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <TripStatusBadge status={status} className="border-white/25 bg-paper-50/95 shadow-sm backdrop-blur-[1px]" />
            {trip.isDemo && (
              <Badge
                variant="outline"
                className="border-white/25 bg-forest-950/45 text-paper-50"
              >
                Example
              </Badge>
            )}
          </div>
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-forest-950/45 text-paper-50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-[19px] font-semibold leading-snug tracking-[-0.02em] text-forest-900">
          {trip.name}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-500">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{trip.destination}</span>
        </p>

        <div className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-700">
          <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-ink-400" />
          {formatDateRange(trip.startDate, trip.endDate)}
        </div>

        <p className="mt-1 text-[11.5px] text-ink-500">
          {formatCount(activityCount, "activity", "activities")} planned
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
          <div className="flex items-center gap-2">
            <AvatarStack members={trip.members} max={3} size="xs" />
            <span className="text-[11.5px] text-ink-500">
              {travellers} travellers
            </span>
          </div>
          {trip.budget !== null ? (
            <span className="text-[12px] font-medium text-forest-800">
              {formatCurrency(trip.budget, trip.currency)}
            </span>
          ) : (
            <span className="text-[11.5px] text-ink-400">No budget set</span>
          )}
        </div>
      </div>
    </Link>
  );
}
