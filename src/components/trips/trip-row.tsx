"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge, TripStatusBadge } from "@/components/ui/badge";
import { useDemoStore } from "@/lib/demo-store";
import {
  formatCount,
  formatCurrency,
  formatDateRange,
} from "@/lib/format";
import type { Trip, TripStatus } from "@/lib/types";

export function TripRow({
  trip,
  currentUserId,
  status,
}: {
  trip: Trip;
  currentUserId: string;
  status: TripStatus;
}) {
  const { state } = useDemoStore();
  const activityCount = state.itinerary.filter(
    (item) => item.tripId === trip.id,
  ).length;
  const travellers = trip.travellerCount ?? trip.members.length;

  return (
    <Link
      href={`/preview/trips/${trip.id}`}
      className="group flex items-center gap-4 border-b border-line py-4 transition-colors last:border-b-0 hover:bg-paper-100/45 sm:gap-5"
    >
      <div className="relative h-[62px] w-[82px] shrink-0 overflow-hidden rounded-lg bg-paper-200 sm:h-16 sm:w-[104px]">
        <Image
          src={trip.coverImage}
          alt={trip.coverAlt}
          fill
          sizes="104px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[17px] font-semibold leading-tight tracking-[-0.015em] text-forest-900 sm:text-[18px]">
            {trip.name}
          </h3>
          {trip.isDemo && <Badge variant="outline">Example</Badge>}
          <TripStatusBadge status={status} className="sm:hidden" />
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-ink-500">
          <MapPin aria-hidden="true" className="size-3 shrink-0" />
          {trip.destination}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-700">
          <CalendarDays aria-hidden="true" className="size-3 shrink-0 text-ink-400" />
          {formatDateRange(trip.startDate, trip.endDate)}
        </p>
      </div>

      <div className="hidden w-36 shrink-0 lg:block">
        <AvatarStack members={trip.members} max={3} size="xs" />
        <p className="mt-1.5 text-[11px] text-ink-500">
          {travellers} travellers
        </p>
        <p className="mt-0.5 text-[11px] text-ink-400">
          {formatCount(activityCount, "activity", "activities")}
        </p>
      </div>

      <div className="hidden w-28 shrink-0 text-right md:block">
        <p className="text-[12.5px] font-medium text-forest-800">
          {trip.budget !== null ? formatCurrency(trip.budget, trip.currency) : "—"}
        </p>
        <p className="mt-0.5 text-[10.5px] text-ink-400">
          {trip.ownerId === currentUserId ? "You own this" : "You joined"}
        </p>
      </div>

      <div className="hidden shrink-0 sm:block">
        <TripStatusBadge status={status} />
      </div>

      <ArrowRight
        aria-hidden="true"
        className="size-4 shrink-0 text-ink-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-forest-700"
      />
    </Link>
  );
}
