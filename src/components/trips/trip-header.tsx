"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, Eye, MapPin, Users } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge, TripStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TripActions } from "@/components/trips/trip-actions";
import { MembersDialog } from "@/components/trips/members-dialog";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { InviteDialog } from "@/components/invitations/invite-dialog";
import { useDemoStore } from "@/lib/demo-store";
import { formatDateRange, formatCount, tripStatus } from "@/lib/format";
import type { Trip } from "@/lib/types";

export function TripHeader({ trip }: { trip: Trip }) {
  const pathname = usePathname();
  const { state } = useDemoStore();
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const currentUserId = state.profile.id;
  const travellers = trip.travellerCount ?? trip.members.length;
  const status = tripStatus(trip);
  const isOwner = trip.ownerId === currentUserId;
  const owner = trip.members.find((member) => member.role === "owner");
  const isOverview = pathname === `/preview/trips/${trip.id}`;
  // The owner's member management lives beside the invite button, so roles and
  // pending invitations are reachable from the same place as the invitation.

  if (!isOverview) {
    return (
      <div>
        <Link
          href="/preview/trips"
          className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-500 transition-colors hover:text-forest-800 lg:hidden"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All trips
        </Link>

        <div className="rounded-xl border border-line bg-card p-3 shadow-soft sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-line bg-paper-200 sm:size-16">
              <Image
                src={trip.coverImage}
                alt=""
                aria-hidden="true"
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="truncate font-display text-[21px] font-semibold leading-tight tracking-[-0.02em] text-forest-900 sm:text-[24px]">
                  {trip.name}
                </h1>
                <TripStatusBadge status={status} />
                {trip.isDemo && (
                  <Badge variant="outline">
                    <Eye aria-hidden="true" className="size-3" />
                    Example trip
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-500 sm:text-[11.5px]">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3 shrink-0" />
                  <span className="truncate">{trip.destination}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays aria-hidden="true" className="size-3 shrink-0" />
                  {formatDateRange(trip.startDate, trip.endDate)}
                </span>
              </div>
              <div className="mt-1.5 hidden items-center gap-2 text-[11px] text-ink-500 sm:flex">
                <AvatarStack members={trip.members} max={3} size="xs" />
                <span>{formatCount(travellers, "traveller")}</span>
                <span aria-hidden="true" className="text-ink-300">
                  ·
                </span>
                <span>
                  {trip.isDemo
                    ? "Read-only example · copy it to make changes"
                    : isOwner
                      ? "You own this trip"
                      : "You're a member"}
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              {trip.isDemo ? (
                <CopyTripButton
                  tripId={trip.id}
                  size="sm"
                  label="Create a copy"
                />
              ) : (
                isOwner && <InviteDialog trip={trip} size="sm" />
              )}
              <TripActions trip={trip} />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5 sm:hidden">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-ink-500">
              <AvatarStack members={trip.members} max={3} size="xs" />
              <span className="truncate">
                {formatCount(travellers, "traveller")} ·{" "}
                {trip.isDemo ? "Read-only" : isOwner ? "Owner" : "Member"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {trip.isDemo ? (
                <CopyTripButton
                  tripId={trip.id}
                  size="sm"
                  label="Copy"
                  className="px-2"
                />
              ) : (
                isOwner && (
                  <InviteDialog
                    trip={trip}
                    triggerLabel="Invite"
                    size="sm"
                    className="px-2"
                  />
                )
              )}
              <TripActions trip={trip} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/preview/trips"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-500 transition-colors hover:text-forest-800 lg:hidden"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All trips
      </Link>

      <div className="relative overflow-hidden rounded-xl border border-forest-950/20 bg-forest-900">
        <Image
          src={trip.coverImage}
          alt={trip.coverAlt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1100px"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,35,26,0.94)_0%,rgba(12,35,26,0.55)_48%,rgba(12,35,26,0.12)_100%)]"
        />

        <div className="relative flex min-h-[232px] flex-col justify-end px-4 pb-5 pt-16 sm:min-h-[276px] sm:px-7 sm:pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <TripStatusBadge
              status={status}
              className="border-paper-50/20 bg-paper-50/10 text-paper-50 backdrop-blur-[1px]"
            />
            <Badge
              variant="outline"
              className="border-paper-50/20 bg-forest-950/20 text-paper-50"
            >
              {trip.isDemo
                ? "Example trip · read-only"
                : isOwner
                  ? "You own this trip"
                  : "You're a member"}
            </Badge>
          </div>

          <h1 className="display-heading mt-3 max-w-3xl text-[30px] text-paper-50 sm:text-[38px] lg:text-[44px]">
            {trip.name}
          </h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-paper-100/90">
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-3.5 text-paper-200/70" />
              {trip.destination}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays
                aria-hidden="true"
                className="size-3.5 text-paper-200/70"
              />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AvatarStack members={trip.members} max={4} size="sm" />
          <div>
            <p className="text-[12.5px] font-medium text-forest-900">
              {formatCount(travellers, "traveller")}
            </p>
            <p className="text-[11.5px] text-ink-500">
              {trip.isDemo
                ? "Read-only example · create a copy to edit"
                : owner
                  ? `${owner.name.split(" ")[0]} is the owner`
                  : "No owner assigned"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {trip.isDemo ? (
            <CopyTripButton tripId={trip.id} size="md" />
          ) : (
            isOwner && (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setMembersOpen(true)}
                >
                  <Users aria-hidden="true" className="size-4" />
                  Members
                </Button>
                <InviteDialog trip={trip} size="md" />
              </>
            )
          )}
          <TripActions trip={trip} />
        </div>
      </div>

      {isOwner && !trip.isDemo && (
        <MembersDialog
          trip={trip}
          open={membersOpen}
          onOpenChange={setMembersOpen}
          onInvite={() => setInviteOpen(true)}
        />
      )}
      {isOwner && !trip.isDemo && (
        <InviteDialog
          key={`invite-${inviteOpen}`}
          trip={trip}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          hideTrigger
        />
      )}
    </div>
  );
}
