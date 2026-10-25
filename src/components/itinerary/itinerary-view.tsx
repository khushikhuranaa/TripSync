"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AddActivityDialog } from "@/components/itinerary/add-activity-dialog";
import {
  ActivityIcon,
  activityLabel,
} from "@/components/itinerary/activity-meta";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState, InlineNotice } from "@/components/ui/feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/cn";
import {
  eachDay,
  formatCount,
  formatCurrency,
  formatDateShort,
  formatDayLabel,
  formatTimeRange,
  formatWeekday,
} from "@/lib/format";
import type { ItineraryItem } from "@/lib/types";
import { TripUnavailable } from "@/components/trips/trip-unavailable";

function ActivityMenu({
  item,
  onEdit,
  onDelete,
}: {
  item: ItineraryItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-ink-400"
          aria-label={`Actions for ${item.title}`}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden="true" className="size-4 text-ink-400" />
          Edit activity
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-line" />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 aria-hidden="true" className="size-4" />
          Remove activity
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ItineraryView({
  tripId,
  today,
}: {
  tripId: string;
  today: string;
}) {
  const { state, deleteItineraryItem, moveItineraryItem } = useDemoStore();
  const trip = state.trips.find((entry) => entry.id === tripId);
  const items = state.itinerary.filter((item) => item.tripId === tripId);
  const myAccess = trip?.members.find((member) => member.isCurrentUser)?.access;
  // Owners and editors may change the plan; viewers get a read-only view. The
  // server re-checks this on every mutation, so hiding controls is convenience,
  // not the security boundary.
  const canEdit =
    Boolean(trip) &&
    !trip?.isDemo &&
    (myAccess === "owner" || myAccess === "editor");
  const [moving, setMoving] = useState<string | null>(null);

  const days = trip ? eachDay(trip.startDate, trip.endDate) : [];
  const initialDay = trip
    ? days.includes(today)
      ? today
      : (days.find((day) => items.some((item) => item.date === day)) ?? days[0])
    : today;

  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [editItem, setEditItem] = useState<ItineraryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ItineraryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // The persisted position is the source of truth. Rows saved before positions
  // existed share the default 0, so the scheduled time breaks those ties.
  const sortedItems = items
    .filter((item) => item.date === selectedDay)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.startTime.localeCompare(b.startTime),
    );

  if (!trip) return <TripUnavailable />;

  const selectedIndex = days.indexOf(selectedDay);
  const selectedCount = sortedItems.length;
  const dayEstimate = sortedItems.reduce(
    (total, item) => total + (item.estimatedCost ?? 0),
    0,
  );
  const tripEstimate = items.reduce(
    (total, item) => total + (item.estimatedCost ?? 0),
    0,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[206px_1fr] lg:items-start lg:gap-8">
      <aside aria-label="Choose a day" className="min-w-0 lg:sticky lg:top-24">
        <p className="eyebrow mb-2.5 hidden lg:block">Days</p>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {days.map((day, index) => {
            const active = day === selectedDay;
            const count = items.filter((item) => item.date === day).length;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "group flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors lg:w-full lg:px-3 lg:py-2.5",
                  active
                    ? "border-forest-800 bg-forest-900 text-paper-50"
                    : "border-line bg-card text-ink-700 hover:border-line-strong hover:bg-paper-100/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                    active
                      ? "bg-paper-50/12 text-paper-50"
                      : "bg-paper-100 text-forest-800",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[9.5px] font-semibold uppercase tracking-[0.12em]",
                      active ? "text-paper-200/70" : "text-ink-400",
                    )}
                  >
                    {formatWeekday(day)}
                  </span>
                  <span className="block whitespace-nowrap text-[12px] font-medium">
                    {formatDateShort(day)}
                  </span>
                </span>
                <span
                  className={cn(
                    "ml-auto hidden text-[10px] tabular-nums lg:block",
                    active ? "text-paper-200/70" : "text-ink-400",
                  )}
                >
                  {count} {count === 1 ? "item" : "items"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">
              Day {selectedIndex + 1} of {days.length}
            </p>
            <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.02em] text-forest-900 sm:text-[27px]">
              {formatDayLabel(selectedDay)}
            </h2>
            <p className="mt-1 text-[12px] text-ink-500">
              {formatCount(selectedCount, "activity", "activities")} planned
              {dayEstimate > 0 && (
                <>
                  {" · "}≈ {formatCurrency(dayEstimate, trip.currency)} estimated
                  for this day
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/preview/trips/${trip.id}/ai-planner`}
              className={buttonStyles({ variant: "secondary", size: "md" })}
            >
              <Sparkles aria-hidden="true" className="size-4" />
              Draft with AI
            </Link>
            {trip.isDemo ? (
              <CopyTripButton tripId={trip.id} size="md" label="Copy to edit" />
            ) : canEdit ? (
              <AddActivityDialog trip={trip} day={selectedDay} />
            ) : null}
          </div>
        </div>

        {trip.isDemo && (
          <div className="mt-4">
            <InlineNotice variant="preview" title="Example trip — read only">
              Explore every activity below. To add, edit or remove plans, create
              your own independent copy; the original example stays intact.
            </InlineNotice>
          </div>
        )}

        {!trip.isDemo && !canEdit && (
          <div className="mt-4">
            <InlineNotice variant="info" title="View-only access">
              You can review this itinerary, but only the trip owner or an editor
              can add, move, edit or remove activities.
            </InlineNotice>
          </div>
        )}

        {sortedItems.length > 0 ? (
          <ol className="relative ml-[5px] mt-6 border-l border-line pl-5 sm:ml-2 sm:pl-6">
            {sortedItems.map((item) => {
              const creator = trip.members.find(
                (member) => member.id === item.createdBy,
              );
              return (
                <li key={item.id} className="relative pb-6 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[27px] top-2 size-[9px] rounded-full border-2 border-paper-50 bg-forest-600 sm:-left-[31px]"
                  />
                  <div className="flex gap-3">
                    <ActivityIcon category={item.category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <h3 className="text-[13.5px] font-semibold leading-5 text-forest-900">
                            {item.title}
                          </h3>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-500">
                            <span className="font-medium text-forest-800">
                              {formatTimeRange(item.startTime, item.endTime)}
                            </span>
                            <span aria-hidden="true" className="text-ink-400">
                              ·
                            </span>
                            <span>
                              {item.location}
                              {item.address ? `, ${item.address}` : ""}
                            </span>
                            {(item.location.trim() || item.mapUrl) && (
                              <a
                                href={
                                  item.mapUrl ||
                                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.location}, ${trip.destination}`)}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Find ${item.title} on a map`}
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-forest-700 hover:text-forest-900"
                              >
                                <MapPin aria-hidden="true" className="size-3" />
                                Map
                              </a>
                            )}
                            {item.referenceUrl && (
                              <a
                                href={item.referenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open the reference link for ${item.title}`}
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-forest-700 hover:text-forest-900"
                              >
                                <ExternalLink aria-hidden="true" className="size-3" />
                                Reference
                              </a>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.estimatedCost !== undefined &&
                            item.estimatedCost > 0 && (
                              <span className="whitespace-nowrap rounded-full border border-line bg-paper-50 px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-ink-700">
                                ≈ {formatCurrency(item.estimatedCost, trip.currency)}
                              </span>
                            )}
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-ink-400"
                                aria-label={`Move ${item.title} earlier`}
                                disabled={
                                  sortedItems[0]?.id === item.id || moving === item.id
                                }
                                onClick={async () => {
                                  setMoving(item.id);
                                  await moveItineraryItem(item.id, "up");
                                  setMoving(null);
                                }}
                              >
                                <ArrowUp aria-hidden="true" className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-ink-400"
                                aria-label={`Move ${item.title} later`}
                                disabled={
                                  sortedItems[sortedItems.length - 1]?.id === item.id ||
                                  moving === item.id
                                }
                                onClick={async () => {
                                  setMoving(item.id);
                                  await moveItineraryItem(item.id, "down");
                                  setMoving(null);
                                }}
                              >
                                <ArrowDown aria-hidden="true" className="size-4" />
                              </Button>
                              <ActivityMenu
                                item={item}
                                onEdit={() => setEditItem(item)}
                                onDelete={() => setDeleteItem(item)}
                              />
                            </>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <p className="mt-2 max-w-2xl text-[12px] leading-5 text-ink-500">
                          {item.description}
                        </p>
                      )}

                      {item.source === "ai" && (
                        <p className="mt-1.5 max-w-2xl text-[10.5px] leading-4 text-ink-400">
                          AI suggestion — estimated, not verified. Confirm opening
                          hours, prices and availability before relying on it.
                        </p>
                      )}

                      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[10.5px] text-ink-400">
                        <span>{activityLabel(item.category)}</span>
                        {creator && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Added by {creator.name.split(" ")[0]}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={CalendarPlus}
              title="Nothing planned for this day yet"
              description={
                trip.isDemo
                  ? "This example day is intentionally open. Your own copy starts with the same plan and can be changed freely."
                  : "Add an activity with a time and place, or start from an AI draft and keep only the suggestions that fit."
              }
              action={
                trip.isDemo ? (
                  <CopyTripButton tripId={trip.id} />
                ) : !canEdit ? (
                  <p className="text-[12px] text-ink-500">
                    Ask the owner for editing access to add activities.
                  </p>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2">
                    <AddActivityDialog trip={trip} day={selectedDay} />
                    <Link
                      href={`/preview/trips/${trip.id}/ai-planner`}
                      className={buttonStyles({ variant: "secondary", size: "md" })}
                    >
                      <Sparkles aria-hidden="true" className="size-4" />
                      Open AI planner
                    </Link>
                  </div>
                )
              }
            />
          </div>
        )}

        {!trip.isDemo && (
          <div className="mt-6">
            <InlineNotice variant="info">
              Every change here is saved to the trip on the server. Members see
              the same itinerary on any device, and it survives a refresh or a
              new sign-in.
            </InlineNotice>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5 text-[10.5px] text-ink-400">
          <CalendarDays aria-hidden="true" className="size-3" />
          {days.length} days · {formatCount(items.length, "activity", "activities")} in
          total
          {tripEstimate > 0 && (
            <>
              {" · "}≈ {formatCurrency(tripEstimate, trip.currency)} estimated
            </>
          )}
        </div>
      </div>

      {canEdit && (
        <>
          {editItem && (
            <AddActivityDialog
              trip={trip}
              day={selectedDay}
              item={editItem}
              open={Boolean(editItem)}
              onOpenChange={(open) => {
                if (!open) setEditItem(null);
              }}
              hideTrigger
            />
          )}

          <Dialog
            open={Boolean(deleteItem)}
            onOpenChange={(open) => {
              if (!open) setDeleteItem(null);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Remove “{deleteItem?.title}”?</DialogTitle>
                <DialogDescription>
                  This removes the activity from the itinerary for every member
                  of the trip. Other activities are left untouched.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" disabled={deleting} onClick={() => setDeleteItem(null)}>
                  Keep activity
                </Button>
                <Button
                  variant="danger"
                  disabled={deleting}
                  onClick={async () => {
                    if (!deleteItem || deleting) return;
                    setDeleting(true);
                    const removed = await deleteItineraryItem(deleteItem.id);
                    setDeleting(false);
                    if (removed) setDeleteItem(null);
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {deleting ? "Removing…" : "Remove activity"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
