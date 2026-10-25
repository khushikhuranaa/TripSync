"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Backpack,
  CalendarDays,
  CircleDollarSign,
  History,
  MapPin,
  ReceiptText,
  Vote,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BudgetBar } from "@/components/trips/budget-bar";
import { InviteDialog } from "@/components/invitations/invite-dialog";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { TripUnavailable } from "@/components/trips/trip-unavailable";
import { useDemoStore } from "@/lib/demo-store";
import { summarizeExpenses } from "@/lib/money";
import {
  daysUntil,
  eachDay,
  formatCount,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDayLabel,
  formatTime,
  relativeDay,
  tripLength,
} from "@/lib/format";

export default function TripOverviewPage() {
  const params = useParams<{ tripId: string }>();
  const { state } = useDemoStore();
  const tripId = params.tripId;
  const trip = state.trips.find((entry) => entry.id === tripId);

  if (!trip) return <TripUnavailable />;

  const currentProfile = state.profile;
  const today = new Date();
  const items = state.itinerary.filter((item) => item.tripId === trip.id);
  const expenses = state.expenses.filter((expense) => expense.tripId === trip.id);
  const tripPolls = state.polls.filter((poll) => poll.tripId === trip.id);
  const packing = state.packingItems.filter((item) => item.tripId === trip.id);
  const notes = state.notes
    .filter((note) => note.tripId === trip.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const days = eachDay(trip.startDate, trip.endDate);
  const summary = summarizeExpenses(
    expenses,
    trip.members.map((member) => member.id),
    trip.budget,
  );

  const nextItems = items
    .filter((item) => daysUntil(item.date, today) >= 0)
    .sort((a, b) =>
      `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
    )
    .slice(0, 4);

  const packedCount = packing.filter((item) => item.packed).length;
  const openPollCount = tripPolls.filter((poll) => poll.status === "open").length;
  const activity = trip.activity ?? [];
  const owner = trip.members.find((member) => member.role === "owner");
  const isOwner = trip.ownerId === currentProfile.id;

  const glances = [
    {
      href: `/preview/trips/${trip.id}/itinerary`,
      icon: CalendarDays,
      label: "Itinerary",
      value: formatCount(items.length, "activity", "activities"),
      detail: `across ${formatCount(days.length, "day")}`,
    },
    {
      href: `/preview/trips/${trip.id}/expenses`,
      icon: CircleDollarSign,
      label: "Expenses",
      value: formatCurrency(summary.total, trip.currency),
      detail: "recorded so far",
    },
    {
      href: `/preview/trips/${trip.id}/polls`,
      icon: Vote,
      label: "Polls",
      value: formatCount(tripPolls.length, "poll"),
      detail: openPollCount > 0 ? `${openPollCount} open` : "all closed",
    },
    {
      href: `/preview/trips/${trip.id}/packing`,
      icon: Backpack,
      label: "Packing list",
      value: packing.length > 0 ? `${packedCount} of ${packing.length}` : "Not started",
      detail: packing.length > 0 ? "items packed" : "add the first item",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start lg:gap-8">
      <div className="space-y-8">
        <section>
          <p className="eyebrow">About this trip</p>
          <p className="mt-2 max-w-2xl text-[14px] leading-7 text-ink-700">
            {trip.description}
          </p>
          {trip.isDemo && (
            <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper-100/60 px-3 py-2 text-[11.5px] leading-5 text-ink-500">
              This is the read-only example trip. Its itinerary, expenses, polls,
              packing list and notes can be explored, but not changed.
              <CopyTripButton tripId={trip.id} size="sm" label="Make an editable copy" />
            </p>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading
            title="Plan at a glance"
            description="The four places the group keeps coming back to."
          />
          <div className="grid overflow-hidden rounded-xl border border-line bg-card sm:grid-cols-2">
            {glances.map(({ href, icon: Icon, label, value, detail }, index) => (
              <Link
                key={label}
                href={href}
                className={[
                  "group flex items-start gap-3 p-4 transition-colors hover:bg-paper-100/50",
                  index < 3 ? "border-b border-line" : "",
                  index % 2 === 0 ? "sm:border-r sm:border-line" : "",
                  index >= 2 ? "sm:border-b-0" : "",
                ].join(" ")}
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-50 text-forest-700">
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                      {label}
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 text-ink-400 transition-colors group-hover:text-forest-700"
                    />
                  </span>
                  <span className="mt-1 block text-[15px] font-semibold text-forest-900">
                    {value}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-500">
                    {detail}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading
            title="Next on the plan"
            description="The next few activities from today onward."
            action={
              <Link
                href={`/preview/trips/${trip.id}/itinerary`}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-forest-800 hover:text-clay-700"
              >
                Open itinerary
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
          />

          {nextItems.length > 0 ? (
            <ol className="divide-y divide-line border-y border-line">
              {nextItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3.5">
                  <div className="w-[76px] shrink-0">
                    <p className="text-[11px] font-semibold text-forest-800">
                      {formatTime(item.startTime)}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-400">
                      {formatDayLabel(item.date)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-5 text-forest-900">
                      {item.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                      <MapPin aria-hidden="true" className="size-3 shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </p>
                  </div>
                  {item.estimatedCost !== undefined && item.estimatedCost > 0 && (
                    <span className="shrink-0 text-[11.5px] tabular-nums text-ink-500">
                      ≈ {formatCurrency(item.estimatedCost, trip.currency)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-[12.5px] leading-5 text-ink-500">
              Nothing is scheduled from today onward. The itinerary is still
              available for reference.
            </p>
          )}
        </section>

        {activity.length > 0 && (
          <section className="space-y-3">
            <SectionHeading
              title="Recent activity"
              description="What changed on this trip, and who changed it."
            />
            <ol className="divide-y divide-line border-y border-line">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-paper-50 text-forest-700">
                    <History aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-5 text-forest-900">
                      {entry.summary}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-400">
                      {entry.actorName ?? "A member"} · {relativeDay(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {notes.length > 0 && (
          <section className="space-y-3">
            <SectionHeading
              title="Shared notes"
              description="Practical details the group should not have to hunt for."
              action={
                <Link
                  href={`/preview/trips/${trip.id}/notes`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-forest-800 hover:text-clay-700"
                >
                  All notes
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              }
            />
            <div className="rounded-xl border border-line bg-paper-100/45 px-4 py-4">
              <p className="text-[12.5px] font-semibold text-forest-900">
                {notes[0].title}
              </p>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-ink-500">
                {notes[0].body}
              </p>
              <p className="mt-2 text-[10.5px] text-ink-400">
                {trip.members.find((member) => member.id === notes[0].authorId)?.name}
              </p>
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <section className="card-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Budget snapshot</p>
            <Link
              href={`/preview/trips/${trip.id}/expenses`}
              className="text-[11px] font-medium text-forest-800 hover:text-clay-700"
            >
              Expenses
            </Link>
          </div>
          <p className="mt-3 font-display text-[28px] font-semibold tracking-[-0.02em] text-forest-900">
            {formatCurrency(summary.total, trip.currency)}
          </p>
          <p className="text-[11.5px] text-ink-500">
            recorded{" "}
            {trip.budget !== null
              ? `of ${formatCurrency(trip.budget, trip.currency)}`
              : "with no budget set"}
          </p>
          <div className="mt-4">
            <BudgetBar
              budget={trip.budget}
              spent={summary.total}
              currency={trip.currency}
              showLabels={false}
            />
          </div>
          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Recorded</dt>
              <dd className="font-medium tabular-nums text-forest-900">
                {formatCurrency(summary.total, trip.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Remaining</dt>
              <dd
                className={
                  summary.remaining !== null && summary.remaining < 0
                    ? "font-medium tabular-nums text-clay-700"
                    : "font-medium tabular-nums text-forest-900"
                }
              >
                {summary.remaining === null
                  ? "No budget"
                  : formatCurrency(summary.remaining, trip.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Your share</dt>
              <dd className="font-medium tabular-nums text-forest-900">
                {formatCurrency(
                  summary.balances.find(
                    (balance) => balance.memberId === currentProfile.id,
                  )?.share ?? 0,
                  trip.currency,
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10.5px] leading-4 text-ink-400">
            Shares come from each saved split — equal by default, or the custom
            amounts members entered — calculated in paise so they add up exactly.
          </p>
        </section>

        <section className="card-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Travellers</p>
            <Badge variant="outline">{trip.members.length}</Badge>
          </div>
          <ul className="mt-3 space-y-2.5">
            {trip.members.map((member) => (
              <li key={member.id} className="flex items-center gap-2.5">
                <Avatar member={member} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-forest-900">
                    {member.name}
                    {member.id === currentProfile.id && (
                      <span className="ml-1.5 text-[10.5px] font-normal text-ink-400">
                        you
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[10.5px] text-ink-400">
                    {member.email}
                  </p>
                </div>
                {member.role === "owner" && (
                  <Badge variant="sage" className="shrink-0">
                    Owner
                  </Badge>
                )}
              </li>
            ))}
          </ul>

          {trip.isDemo ? (
            <p className="mt-4 rounded-lg border border-line bg-paper-50 px-3 py-2 text-[10.5px] leading-4 text-ink-500">
              This example trip is read-only. Create your own copy to invite
              people and edit the plan.
            </p>
          ) : isOwner ? (
            <InviteDialog
              trip={trip}
              size="sm"
              className="mt-4 w-full"
            />
          ) : (
            <p className="mt-4 rounded-lg border border-line bg-paper-50 px-3 py-2 text-[10.5px] leading-4 text-ink-500">
              {owner?.name.split(" ")[0]} manages invitations for this trip.
            </p>
          )}
        </section>

        <section className="card-surface p-4 sm:p-5">
          <p className="eyebrow">Trip details</p>
          <dl className="mt-3 space-y-2.5 text-[12px]">
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-ink-500">Dates</dt>
              <dd className="text-right font-medium text-forest-900">
                {formatDateRange(trip.startDate, trip.endDate)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-ink-500">Length</dt>
              <dd className="text-right font-medium text-forest-900">
                {formatCount(tripLength(trip.startDate, trip.endDate), "day")}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-ink-500">Destination</dt>
              <dd className="text-right font-medium text-forest-900">
                {trip.region}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-ink-500">Owner</dt>
              <dd className="text-right font-medium text-forest-900">
                {owner?.name}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-ink-500">Created</dt>
              <dd className="text-right font-medium text-forest-900">
                {formatDate(trip.createdAt, { year: undefined })}
              </dd>
            </div>
          </dl>
        </section>

        <p className="flex items-center gap-1.5 px-1 text-[10.5px] text-ink-400">
          <ReceiptText aria-hidden="true" className="size-3" />
          {trip.isDemo
            ? "Read-only example · copy it to edit"
            : "Saved to your account · visible to trip members only"}
        </p>
      </aside>
    </div>
  );
}
