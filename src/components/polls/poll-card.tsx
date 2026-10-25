"use client";

import { useState } from "react";
import { Check, Clock, LockKeyhole, Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PollBars } from "@/components/polls/poll-bars";
import { useDemoStore } from "@/lib/demo-store";
import { getPollResult } from "@/lib/polls";
import { formatDate } from "@/lib/format";
import type { Poll, Trip } from "@/lib/types";
import { cn } from "@/lib/cn";

export function PollCard({ poll, trip }: { poll: Poll; trip: Trip }) {
  const { state, votePoll, closePoll } = useDemoStore();
  const myVote = poll.options.find((option) =>
    option.voterIds.includes(state.profile.id),
  )?.id;
  const [selected, setSelected] = useState<string | null>(myVote ?? null);
  const [voting, setVoting] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const result = getPollResult(poll);
  const isOpen = poll.status === "open";
  const isExpired = poll.status === "expired";
  const creator = trip.members.find((member) => member.id === poll.createdBy);
  const canClose =
    isOpen &&
    !trip.isDemo &&
    (poll.createdBy === state.profile.id || trip.ownerId === state.profile.id);
  const closesLabel = poll.closesAt
    ? `${isOpen ? "Closes" : isExpired ? "Expired" : "Closed"} ${formatDate(
        poll.closesAt.slice(0, 10),
        { year: undefined },
      )}`
    : isOpen
      ? "No closing date"
      : "Closed";

  return (
    <article className="card-surface flex flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={isOpen ? "sage" : "muted"}>
            {isOpen ? (
              <Vote aria-hidden="true" className="size-3" />
            ) : isExpired ? (
              <Clock aria-hidden="true" className="size-3" />
            ) : (
              <LockKeyhole aria-hidden="true" className="size-3" />
            )}
            {isOpen ? "Open" : isExpired ? "Expired" : "Closed"}
          </Badge>
          {myVote && (
            <Badge variant="outline">
              <Check aria-hidden="true" className="size-3" />
              You voted
            </Badge>
          )}
        </div>
        <span className="text-[10.5px] text-ink-400">{closesLabel}</span>
      </div>

      <h3 className="mt-3 font-display text-[19px] font-semibold leading-snug tracking-[-0.015em] text-forest-900">
        {poll.question}
      </h3>
      {poll.description && (
        <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-5 text-ink-500">
          {poll.description}
        </p>
      )}
      <p className="mt-1 text-[11px] text-ink-400">
        Asked by {creator?.name.split(" ")[0] ?? "a member"} ·{" "}
        {poll.options.length} options
      </p>

      {isOpen && !trip.isDemo ? (
        <fieldset className="mt-4">
          <legend className="sr-only">{poll.question}</legend>
          <div className="space-y-1.5">
            {poll.options.map((option) => {
              const active = selected === option.id;
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] transition-colors",
                    active
                      ? "border-forest-700 bg-sage-50 text-forest-900"
                      : "border-line bg-card text-ink-700 hover:border-line-strong hover:bg-paper-100/50",
                  )}
                >
                  <input
                    type="radio"
                    name={`poll-${poll.id}`}
                    value={option.id}
                    checked={active}
                    onChange={() => setSelected(option.id)}
                    className="size-4 shrink-0 accent-forest-800"
                  />
                  <span className="min-w-0 flex-1">{option.label}</span>
                  {myVote === option.id && (
                    <span className="shrink-0 text-[10px] font-medium text-forest-700">
                      Your vote
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {isOpen && trip.isDemo ? (
        <p className="mt-3 rounded-lg border border-line bg-paper-50 px-3 py-2 text-[11px] leading-4 text-ink-500">
          This is the read-only example trip. Copy it to vote in this poll.
        </p>
      ) : null}

      {isExpired && (
        <p className="mt-3 rounded-lg border border-line bg-paper-50 px-3 py-2 text-[11px] leading-4 text-ink-500">
          The closing date has passed, so no new votes can be cast. Results stay
          visible for the group.
        </p>
      )}

      <div className="mt-4">
        <p className="mb-2.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Current results
        </p>
        <PollBars
          options={result.options}
          totalVotes={result.totalVotes}
          selectedOptionId={myVote ?? selected}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
        <p className="text-[10.5px] text-ink-400">
          {result.totalVotes} {result.totalVotes === 1 ? "vote" : "votes"} · one
          vote per member
        </p>

        {isOpen ? (
          trip.isDemo ? (
            <span className="text-[10.5px] font-medium text-ink-400">
              Read-only example
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {canClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCloseOpen(true)}
                >
                  Close poll
                </Button>
              )}
              <Button
                size="sm"
                disabled={!selected || selected === myVote || voting}
                onClick={async () => {
                  if (!selected || voting) return;
                  setVoting(true);
                  await votePoll(poll.id, selected);
                  setVoting(false);
                }}
              >
                {voting
                  ? "Recording…"
                  : myVote
                    ? "Change vote"
                    : "Cast vote"}
              </Button>
            </div>
          )
        ) : (
          <span className="text-[10.5px] font-medium text-ink-500">
            {isExpired ? "Voting has expired" : "Voting is closed"}
          </span>
        )}
      </div>

      {canClose && (
        <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Close “{poll.question}”?</DialogTitle>
              <DialogDescription>
                Voting ends immediately for everyone and the results become
                final. A closed poll cannot be reopened.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="secondary"
                disabled={closing}
                onClick={() => setCloseOpen(false)}
              >
                Keep it open
              </Button>
              <Button
                variant="danger"
                disabled={closing}
                onClick={async () => {
                  if (closing) return;
                  setClosing(true);
                  const closed = await closePoll(poll.id);
                  setClosing(false);
                  if (closed) setCloseOpen(false);
                }}
              >
                <LockKeyhole aria-hidden="true" className="size-4" />
                {closing ? "Closing…" : "Close poll"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}
