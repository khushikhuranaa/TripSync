"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Mail,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { TripCard } from "@/components/trips/trip-card";
import { TripStatusBadge } from "@/components/ui/badge";
import { BudgetBar } from "@/components/trips/budget-bar";
import { AvatarStack } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceivedInvitationCard } from "@/components/invitations/received-invitation-card";
import { PollBars } from "@/components/polls/poll-bars";
import { CreateTripDialog } from "@/components/app-shell/create-trip-dialog";
import { useSessionProfile } from "@/components/app-shell/session-provider";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { FeedbackCard } from "@/components/feedback/feedback-card";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { useDemoStore } from "@/lib/demo-store";
import { getPollResult } from "@/lib/polls";
import { summarizeExpenses } from "@/lib/money";
import {
  daysUntil,
  departureLabel,
  formatCount,
  formatCurrency,
  formatDate,
  formatDayLabel,
  formatTime,
  tripStatus,
} from "@/lib/format";

export default function DashboardPage() {
  const session = useSessionProfile();
  const { state } = useDemoStore();
  const profile = state.profile;
  const today = new Date();

  const myTrips = state.trips.filter((trip) =>
    trip.members.some((member) => member.id === profile.id),
  );
  // The greeting and every trip, count and total below are calculated from
  // this account's own rows in the database.
  const firstName = (session?.name ?? profile.name).split(" ")[0];
  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(today);

  const withStatus = myTrips.map((trip) => ({
    trip,
    status: tripStatus(trip, today),
  }));

  const ongoing = withStatus.filter((entry) => entry.status === "ongoing");
  const upcoming = withStatus
    .filter((entry) => entry.status === "upcoming")
    .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
  const completed = withStatus.filter((entry) => entry.status === "completed");

  const featured = ongoing[0] ?? upcoming[0] ?? withStatus[0];
  const featuredTrip = featured?.trip;
  const featuredItinerary = featuredTrip
    ? state.itinerary
        .filter((item) => item.tripId === featuredTrip.id)
        .filter((item) => daysUntil(item.date, today) >= 0)
        .sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
        )
        .slice(0, 3)
    : [];
  const featuredExpenses = summarizeExpenses(
    featuredTrip
      ? state.expenses.filter((expense) => expense.tripId === featuredTrip.id)
      : [],
    featuredTrip ? featuredTrip.members.map((member) => member.id) : [],
    featuredTrip?.budget ?? null,
  );

  const pendingInvitations = state.invitations.filter(
    (invitation) =>
      invitation.kind === "received" && invitation.status === "pending",
  );
  const nextInvitation = pendingInvitations[0];

  const openPoll = state.polls.find(
    (poll) =>
      poll.status === "open" &&
      myTrips.some((trip) => trip.id === poll.tripId),
  );
  const openPollTrip = openPoll
    ? myTrips.find((trip) => trip.id === openPoll.tripId)
    : undefined;
  const openPollResult = openPoll ? getPollResult(openPoll) : undefined;
  const demoTrip = state.trips.find((trip) => trip.isDemo);

  // Most recently changed first, so a group's latest edit is always in view.
  const otherTrips = withStatus
    .filter((entry) => entry.trip.id !== featuredTrip?.id)
    .sort(
      (a, b) =>
        (b.trip.updatedMs ?? b.trip.createdMs ?? 0) -
        (a.trip.updatedMs ?? a.trip.createdMs ?? 0),
    )
    .slice(0, 3);

  const nextDeparture = upcoming[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={todayLabel}
        title={`Welcome back, ${firstName}.`}
        description="Here is where the group's plans stand, and what needs a decision next."
        actions={
          <Link
            href="/preview/trips"
            className={buttonStyles({ variant: "secondary", size: "md" })}
          >
            My trips
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />

      <OnboardingCard />

      <section
        aria-label="Trip summary"
        className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Total trips
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(myTrips.length, "trip")}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Upcoming
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(upcoming.length, "trip")}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Ongoing
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(ongoing.length, "trip")}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Completed
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(completed.length, "trip")}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Next departure
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {nextDeparture
              ? `${formatDate(nextDeparture.trip.startDate, {
                  day: "numeric",
                  month: "short",
                  year: undefined,
                })} · ${departureLabel(nextDeparture.trip.startDate)}`
              : "No upcoming trip"}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Waiting on you
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(pendingInvitations.length, "invitation")}
          </p>
        </div>
      </section>

      <section aria-label="Quick actions" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <CreateTripDialog triggerLabel="Create a trip" />
        <Link
          href="/preview/trips"
          className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}
        >
          <MapPin aria-hidden="true" className="size-4" />
          View trips
        </Link>
        <Link
          href="/preview/invitations"
          className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}
        >
          <Mail aria-hidden="true" className="size-4" />
          Join a trip
        </Link>
        <Link
          href={
            featuredTrip
              ? `/preview/trips/${featuredTrip.id}/ai-planner`
              : "/preview/trips"
          }
          className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}
        >
          <Sparkles aria-hidden="true" className="size-4" />
          Open AI planner
        </Link>
      </section>

      {demoTrip && (
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-paper-100/55 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-forest-700">
              <Sparkles aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12.5px] font-semibold text-forest-900">
                  New here? Open the example trip
                </p>
                <Badge variant="outline">Read-only</Badge>
              </div>
              <p className="mt-0.5 max-w-xl text-[11.5px] leading-5 text-ink-500">
                {demoTrip.name} is fully populated with an itinerary, expenses,
                polls, packing and notes. Explore it, then make an independent
                copy to edit.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={`/preview/trips/${demoTrip.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Open example
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
            <CopyTripButton
              tripId={demoTrip.id}
              size="sm"
              label="Create my own copy"
            />
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        {featured && featuredTrip ? (
          <article className="overflow-hidden rounded-xl border border-line bg-card shadow-soft">
            <div className="relative h-[196px] sm:h-[224px]">
            <Image
              src={featuredTrip.coverImage}
              alt={featuredTrip.coverAlt}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 720px"
              className="object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,35,26,0.9)_0%,rgba(12,35,26,0.35)_55%,rgba(12,35,26,0.05)_100%)]"
            />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <TripStatusBadge
                  status={featured.status}
                  className="border-paper-50/20 bg-paper-50/10 text-paper-50"
                />
                <span className="text-[11px] font-medium text-paper-100/80">
                  {featured.status === "ongoing"
                    ? `${formatCount(Math.max(1, daysUntil(featuredTrip.endDate, today) + 1), "day")} left`
                    : departureLabel(featuredTrip.startDate, today)}
                </span>
                {featuredTrip.isDemo && (
                  <Badge
                    variant="outline"
                    className="border-paper-50/20 bg-forest-950/20 text-paper-50"
                  >
                    Example trip
                  </Badge>
                )}
              </div>
              <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-paper-50 sm:text-[30px]">
                {featuredTrip.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-paper-100/80">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {featuredTrip.destination}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  {formatDate(featuredTrip.startDate)} –{" "}
                  {formatDate(featuredTrip.endDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[1fr_190px]">
            <div className="min-w-0">
              <p className="eyebrow">Next on the plan</p>
              {featuredItinerary.length > 0 ? (
                <ul className="mt-3 divide-y divide-line">
                  {featuredItinerary.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 py-2.5 first:pt-1">
                      <span className="w-[68px] shrink-0 pt-0.5 text-[11px] leading-4 text-ink-500">
                        <span className="block font-medium text-forest-800">
                          {formatTime(item.startTime)}
                        </span>
                        {formatDayLabel(item.date)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium leading-5 text-forest-900">
                          {item.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                          <MapPin aria-hidden="true" className="size-3 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-line-strong px-3 py-4 text-[12px] leading-5 text-ink-500">
                  Nothing is scheduled from today onward. Open the itinerary to add
                  the next plan.
                </p>
              )}
            </div>

            <div className="border-t border-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <p className="eyebrow">Budget</p>
              <div className="mt-3">
                {featuredTrip.budget !== null ? (
                  <>
                    <p className="text-[16px] font-semibold leading-tight text-forest-900">
                      {formatCurrency(
                        featuredExpenses.total,
                        featuredTrip.currency,
                      )}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-500">
                      of {formatCurrency(featuredTrip.budget, featuredTrip.currency)}{" "}
                      budget
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-ink-500">No budget set</p>
                )}
                <BudgetBar
                  budget={featuredTrip.budget}
                  spent={featuredExpenses.total}
                  currency={featuredTrip.currency}
                  showLabels={false}
                  className="mt-2"
                />
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <AvatarStack members={featuredTrip.members} max={3} size="xs" />
                <span className="text-[11px] text-ink-500">
                  {featuredTrip.travellerCount ?? featuredTrip.members.length}{" "}
                  travellers
                </span>
              </div>

              <Link
                href={`/preview/trips/${featuredTrip.id}`}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  className: "mt-4 w-full",
                })}
              >
                Open trip
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          </div>
          </article>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No trips yet"
            description="Create your first trip and its itinerary, expenses and shared lists will live inside it. You can also open the read-only example trip to see how a full plan looks."
            action={<CreateTripDialog triggerLabel="Create your first trip" />}
          />
        )}

        <div className="space-y-5">
          {nextInvitation ? (
            <ReceivedInvitationCard invitation={nextInvitation} compact />
          ) : (
            <div className="rounded-xl border border-line bg-card p-5 shadow-soft">
              <p className="eyebrow">Invitations</p>
              <p className="mt-2 text-[13px] leading-5 text-ink-500">
                Nothing is waiting for a response.
              </p>
            </div>
          )}

          {openPoll && openPollTrip && openPollResult ? (
            <article className="rounded-xl border border-line bg-card p-4 shadow-soft sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="sage">Open poll</Badge>
                <span className="truncate text-[11px] text-ink-400">
                  {openPollTrip.name}
                </span>
              </div>
              <h3 className="mt-3 text-[13px] font-semibold leading-5 text-forest-900">
                {openPoll.question}
              </h3>
              <div className="mt-4">
                <PollBars
                  options={openPollResult.options}
                  totalVotes={openPollResult.totalVotes}
                  compact
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-[11px] text-ink-400">
                  {formatCount(openPollResult.totalVotes, "vote")}
                  {openPoll.closesAt
                    ? ` · closes ${formatDate(openPoll.closesAt.slice(0, 10), {
                        year: undefined,
                      })}`
                    : ""}
                </span>
                <Link
                  href={`/preview/trips/${openPollTrip.id}/polls`}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-forest-800 hover:text-clay-700"
                >
                  Open poll
                  <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      {myTrips.length > 0 && (
        <section className="space-y-4">
          <SectionHeading
            title="Your trips"
            description="The plans you changed most recently."
          action={
            <Link
              href="/preview/trips"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-forest-800 hover:text-clay-700"
            >
              View all {myTrips.length} trips
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        />

        {otherTrips.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {otherTrips.map(({ trip }) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No other trips yet"
            description="Create a trip and invite the group. The itinerary, expenses and packing list will live inside it."
            action={
              <CreateTripDialog triggerLabel="Create a trip" />
            }
          />
        )}
        </section>
      )}

      <FeedbackCard />

      <section className="rounded-xl border border-line bg-paper-100/50 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-forest-700">
              <Plus aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-forest-900">
                Planning the next trip?
              </p>
              <p className="mt-0.5 max-w-xl text-[11.5px] leading-5 text-ink-500">
                Start with a name and dates. You can draft the days by hand or use
                the AI demo planner when the itinerary is ready.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CreateTripDialog triggerLabel="Create a trip" />
          </div>
        </div>
      </section>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[10.5px] text-ink-400">
        <Clock aria-hidden="true" className="size-3" />
        Workspace synced to your TripSync account · same trips on every device
      </p>
    </div>
  );
}
