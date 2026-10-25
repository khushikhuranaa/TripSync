"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import {
  MessageSquareText,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, TripStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatDateRange } from "@/lib/format";
import type {
  AdminUser,
  FeedbackEntry,
  PlatformRole,
  Trip,
  TripStatus,
} from "@/lib/types";
import { cn } from "@/lib/cn";

export interface AdminTripEntry {
  trip: Trip;
  status: TripStatus;
}

const roleBadge: Record<PlatformRole, "forest" | "muted"> = {
  admin: "forest",
  user: "muted",
};

export function AdminView({
  users,
  tripEntries,
  feedback,
}: {
  users: AdminUser[];
  tripEntries: AdminTripEntry[];
  feedback: FeedbackEntry[];
}) {
  const { state, setUserRole } = useDemoStore();
  const [query, setQuery] = useState("");
  const [promoting, setPromoting] = useState<AdminUser | null>(null);
  const [promotingPending, setPromotingPending] = useState(false);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle),
    );
  }, [users, query]);

  const filteredTrips = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tripEntries;
    return tripEntries.filter(
      (entry) =>
        entry.trip.name.toLowerCase().includes(needle) ||
        entry.trip.destination.toLowerCase().includes(needle) ||
        entry.trip.members.some((member) =>
          member.name.toLowerCase().includes(needle),
        ),
    );
  }, [tripEntries, query]);

  const filteredFeedback = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return feedback;
    return feedback.filter(
      (entry) =>
        entry.comment.toLowerCase().includes(needle) ||
        (entry.authorName ?? "").toLowerCase().includes(needle) ||
        (entry.authorEmail ?? "").toLowerCase().includes(needle),
    );
  }, [feedback, query]);

  return (
    <Tabs.Root defaultValue="users">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs.List
          aria-label="Admin data"
          className="flex items-center gap-1 border-b border-line"
        >
          <Tabs.Trigger
            value="users"
            className="relative inline-flex h-11 items-center gap-2 px-3 text-[13px] font-medium text-ink-500 transition-colors hover:text-forest-800 data-[state=active]:text-forest-900 data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-clay-500"
          >
            <Users aria-hidden="true" className="size-4" />
            Users
            <span className="rounded-full bg-paper-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-500">
              {users.length}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="trips"
            className="relative inline-flex h-11 items-center gap-2 px-3 text-[13px] font-medium text-ink-500 transition-colors hover:text-forest-800 data-[state=active]:text-forest-900 data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-clay-500"
          >
            <ShieldCheck aria-hidden="true" className="size-4" />
            Trips
            <span className="rounded-full bg-paper-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-500">
              {tripEntries.length}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="feedback"
            className="relative inline-flex h-11 items-center gap-2 px-3 text-[13px] font-medium text-ink-500 transition-colors hover:text-forest-800 data-[state=active]:text-forest-900 data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-clay-500"
          >
            <MessageSquareText aria-hidden="true" className="size-4" />
            Feedback
            <span className="rounded-full bg-paper-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-500">
              {feedback.length}
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="admin-search" className="sr-only">
            Search users, trips or feedback
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
          />
          <input
            id="admin-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users, trips or feedback"
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

      <Tabs.Content value="users" className="mt-5 focus:outline-none">
        {filteredUsers.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-soft">
            <div className="hidden grid-cols-[1.6fr_0.8fr_0.5fr_0.8fr_auto] gap-4 border-b border-line bg-paper-100/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 md:grid">
              <span>Account</span>
              <span>Role</span>
              <span>Trips</span>
              <span>Joined</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-line">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center md:grid md:grid-cols-[1.6fr_0.8fr_0.5fr_0.8fr_auto] md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      member={{
                        name: user.name,
                        initials: user.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join(""),
                        tone:
                          user.role === "admin"
                            ? "forest"
                            : user.status === "Invited"
                              ? "sand"
                              : "sage",
                      }}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-forest-900">
                        {user.name}
                      </p>
                      <p className="truncate text-[11px] text-ink-500">{user.email}</p>
                    </div>
                    <span className="ml-auto md:hidden">
                      <Badge variant={roleBadge[user.role]}>{user.role}</Badge>
                    </span>
                  </div>

                  <div className="hidden md:block">
                    <Badge variant={roleBadge[user.role]}>{user.role}</Badge>
                  </div>

                  <div className="flex items-center gap-4 text-[11.5px] text-ink-500 md:contents">
                    <span className="md:hidden text-ink-400">Trips</span>
                    <span className="tabular-nums">{user.tripCount}</span>
                    <span className="ml-auto text-[11px] text-ink-400 md:hidden">
                      Joined {formatDate(user.joinedAt, { year: undefined })}
                    </span>
                    <span className="hidden text-[11px] text-ink-500 md:block">
                      {formatDate(user.joinedAt, { year: undefined })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <Badge variant={user.status === "Active" ? "sage" : "outline"}>
                      {user.status}
                    </Badge>
                    {user.role === "admin" ? (
                      <span className="text-[10.5px] text-ink-400">Current admin</span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPromoting(user)}
                      >
                        Make admin
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No users match"
            description="Try a different name or email address, or clear the search."
          />
        )}
      </Tabs.Content>

      <Tabs.Content value="trips" className="mt-5 focus:outline-none">
        {filteredTrips.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-soft">
            <div className="divide-y divide-line">
              {filteredTrips.map(({ trip, status }) => {
                const owner = trip.members.find((member) => member.role === "owner");
                // The workspace only contains trips this account belongs to, so
                // linking a non-member trip would dead-end on the missing-trip
                // state. Oversight rows stay visible; only members can open one.
                const inWorkspace = state.trips.some(
                  (entry) => entry.id === trip.id,
                );
                return (
                  <div
                    key={trip.id}
                    className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-paper-200">
                      <Image
                        src={trip.coverImage}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {inWorkspace ? (
                        <Link
                          href={`/preview/trips/${trip.id}`}
                          className={cn(
                            "truncate text-[12.5px] font-medium text-forest-900 underline-offset-4 hover:underline",
                          )}
                        >
                          {trip.name}
                        </Link>
                      ) : (
                        <span className="block truncate text-[12.5px] font-medium text-forest-900">
                          {trip.name}
                        </span>
                      )}
                      <p className="mt-0.5 truncate text-[11px] text-ink-500">
                        {trip.destination} ·{" "}
                        {formatDateRange(trip.startDate, trip.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-[11px] text-ink-500 sm:text-right">
                        <p>{owner?.name ?? "No owner"}</p>
                        <p className="mt-0.5 text-ink-400">
                          {trip.members.length} members
                        </p>
                      </div>
                      <TripStatusBadge status={status} />
                      {inWorkspace ? (
                        <Link
                          href={`/preview/trips/${trip.id}`}
                          className="text-[11.5px] font-medium text-forest-800 hover:text-clay-700"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-[11.5px] text-ink-400">
                          Not a member
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No trips match"
            description="Try a different trip name, destination or member name."
          />
        )}
      </Tabs.Content>

      <Tabs.Content value="feedback" className="mt-5 focus:outline-none">
        {filteredFeedback.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-soft">
            <div className="hidden grid-cols-[6rem_1fr_1.3fr_8rem] gap-4 border-b border-line bg-paper-100/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 md:grid">
              <span>Rating</span>
              <span>Feedback</span>
              <span>Account</span>
              <span className="text-right">Submitted</span>
            </div>
            <div className="divide-y divide-line">
              {filteredFeedback.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 px-4 py-3.5 md:grid md:grid-cols-[6rem_1fr_1.3fr_8rem] md:items-start md:gap-4"
                >
                  <div>
                    <span
                      className="flex items-center gap-0.5"
                      aria-label={`${entry.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          aria-hidden="true"
                          className={cn(
                            "size-3.5",
                            value <= entry.rating
                              ? "fill-clay-500 text-clay-500"
                              : "text-ink-300",
                          )}
                        />
                      ))}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-ink-400">
                      {entry.rating}/5
                    </span>
                  </div>
                  <p className="whitespace-pre-line break-words text-[12px] leading-5 text-ink-700">
                    {entry.comment || (
                      <span className="text-ink-400">No written comment.</span>
                    )}
                  </p>
                  <div className="text-[11px] leading-4 text-ink-500">
                    <p className="font-medium text-forest-900">
                      {entry.authorName ?? "Unknown account"}
                    </p>
                    <p className="truncate">{entry.authorEmail}</p>
                  </div>
                  <p className="text-[11px] text-ink-500 md:text-right">
                    {formatDate(entry.createdAt.slice(0, 10), { year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={MessageSquareText}
            title={feedback.length === 0 ? "No feedback yet" : "No feedback matches"}
            description={
              feedback.length === 0
                ? "Ratings submitted from the dashboard will appear here for admins."
                : "Try a different comment, name or email address, or clear the search."
            }
          />
        )}
        {feedback.length > 0 && (
          <p className="mt-3 text-[10.5px] text-ink-400">
            Showing the {feedback.length} most recent submissions. Feedback is
            append-only; admins cannot edit or delete entries.
          </p>
        )}
      </Tabs.Content>

      <Dialog
        open={Boolean(promoting)}
        onOpenChange={(open) => {
          if (!open) setPromoting(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make {promoting?.name} an admin?</DialogTitle>
            <DialogDescription>
              Role changes are enforced on the server: only platform admins can
              do this, and the new role applies to the account immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={promotingPending}
              onClick={() => setPromoting(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={promotingPending}
              onClick={async () => {
                if (!promoting || promotingPending) return;
                setPromotingPending(true);
                const updated = await setUserRole(promoting.id, "admin");
                setPromotingPending(false);
                if (updated) setPromoting(null);
              }}
            >
              <ShieldCheck aria-hidden="true" className="size-4" />
              {promotingPending ? "Updating…" : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs.Root>
  );
}
