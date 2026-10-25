"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Vote } from "lucide-react";
import { PollCard } from "@/components/polls/poll-card";
import { PollDialog } from "@/components/polls/poll-dialog";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo-store";
import { formatCount } from "@/lib/format";
import { TripUnavailable } from "@/components/trips/trip-unavailable";

export default function PollsPage() {
  const params = useParams<{ tripId: string }>();
  const { state } = useDemoStore();
  const trip = state.trips.find((entry) => entry.id === params.tripId);

  if (!trip) return <TripUnavailable />;

  const tripPolls = state.polls.filter((poll) => poll.tripId === trip.id);
  const openPolls = tripPolls.filter((poll) => poll.status === "open");
  // Expired polls are settled too: nobody can vote, but the results stay.
  const closedPolls = tripPolls.filter((poll) => poll.status !== "open");

  const myAccess = trip.members.find((member) => member.isCurrentUser)?.access;
  const canEdit =
    !trip.isDemo && (myAccess === "owner" || myAccess === "editor");

  const action = trip.isDemo ? (
    <CopyTripButton tripId={trip.id} size="md" label="Copy to create polls" />
  ) : canEdit ? (
    <PollDialog trip={trip} size="md" />
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Group decisions</p>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-[-0.025em] text-forest-900">
            Ask once, decide together
          </h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-ink-500">
            One question, clear options and a closing time. Members vote once;
            closed polls keep their results visible.
          </p>
        </div>
        {action}
      </div>

      <section className="space-y-3">
        <SectionHeading
          title="Open polls"
          description="Voting is available to every trip member until the closing time."
          action={
            <span className="text-[11px] text-ink-400">
              {formatCount(openPolls.length, "open poll")}
            </span>
          }
        />
        {openPolls.length > 0 ? (
          <div
            className={
              openPolls.length > 1
                ? "grid gap-4 xl:grid-cols-2"
                : "grid max-w-3xl gap-4"
            }
          >
            {openPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} trip={trip} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Vote}
            title="No open polls"
            description={
              trip.isDemo
                ? "This example has no open polls. Make a copy of the trip to start one."
                : "When the group needs to choose between two plans, open a poll with a clear question and a closing time."
            }
            action={
              trip.isDemo ? (
                <CopyTripButton tripId={trip.id} />
              ) : canEdit ? (
                <PollDialog
                  trip={trip}
                  triggerLabel="Create a poll"
                  variant="secondary"
                />
              ) : (
                <p className="text-[12px] text-ink-500">
                  Ask the owner for editing access to open a poll.
                </p>
              )
            }
          />
        )}
      </section>

      {closedPolls.length > 0 && (
        <section className="space-y-3 border-t border-line pt-6">
          <SectionHeading
            title="Closed and expired polls"
            description="Results are retained, but no new votes can be cast. A poll expires when its closing date passes."
            action={
              <span className="text-[11px] text-ink-400">
                {formatCount(closedPolls.length, "settled poll")}
              </span>
            }
          />
          <div
            className={
              closedPolls.length > 1
                ? "grid gap-4 xl:grid-cols-2"
                : "grid max-w-3xl gap-4"
            }
          >
            {closedPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} trip={trip} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[11px] leading-5 text-ink-400">
          Votes are stored with the trip: every member sees the same results on
          any device, and each person can vote once per poll.
        </p>
        <Link
          href={`/preview/trips/${trip.id}`}
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          <Plus aria-hidden="true" className="size-3.5 rotate-45" />
          Back to trip overview
        </Link>
      </div>
    </div>
  );
}
