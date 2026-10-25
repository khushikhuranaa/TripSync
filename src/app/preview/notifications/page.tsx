"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCheck,
  Circle,
  LoaderCircle,
  Mail,
  UsersRound,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { useDemoStore } from "@/lib/demo-store";
import { relativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AppNotification, NotificationType } from "@/lib/types";

const typeIcons: Record<NotificationType, typeof Bell> = {
  invitation: Mail,
  membership: UsersRound,
  poll: BarChart3,
  itinerary: CalendarDays,
  budget: Wallet,
};

const typeLabels: Record<NotificationType, string> = {
  invitation: "Invitation",
  membership: "Membership",
  poll: "Poll",
  itinerary: "Itinerary",
  budget: "Budget",
};

export default function NotificationsPage() {
  const {
    state,
    markNotificationRead,
    markNotificationUnread,
    markAllNotificationsRead,
    loadOlderNotifications,
  } = useDemoStore();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [loadingOlder, setLoadingOlder] = useState(false);
  // The workspace always loads the most recent 30; fewer than that on mount
  // means there is nothing older to ask for.
  const [olderExhausted, setOlderExhausted] = useState(
    state.notifications.length < 30,
  );

  const notifications = state.notifications;
  const unread = notifications.filter((item) => !item.readAt);
  const readCount = notifications.length - unread.length;
  const visible =
    filter === "unread"
      ? notifications.filter((item) => !item.readAt)
      : filter === "read"
        ? notifications.filter((item) => item.readAt)
        : notifications;

  async function loadOlder() {
    if (loadingOlder || olderExhausted || notifications.length === 0) return;
    const cursor = notifications[notifications.length - 1]?.createdAt;
    if (!cursor) return;
    setLoadingOlder(true);
    const items = await loadOlderNotifications(cursor);
    setLoadingOlder(false);
    // A short page means the history is exhausted, so the button disappears.
    if (items.length < 30) setOlderExhausted(true);
  }

  async function toggleRead(notification: AppNotification) {
    if (pendingId) return;
    setPendingId(notification.id);
    if (notification.readAt) await markNotificationUnread(notification.id);
    else await markNotificationRead(notification.id);
    setPendingId(null);
  }

  async function markAll() {
    if (markingAll || unread.length === 0) return;
    setMarkingAll(true);
    await markAllNotificationsRead();
    setMarkingAll(false);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your account"
        title="Notifications"
        description="Trip invitations, membership changes, polls, itinerary updates and budget alerts. These are in-app notifications saved to your account."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void markAll()}
            disabled={unread.length === 0 || markingAll}
          >
            {markingAll ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck aria-hidden="true" className="size-3.5" />
            )}
            Mark all as read
          </Button>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="When someone invites you to a trip, opens a poll or changes a plan you are part of, it will show up here."
          action={
            <Link
              href="/preview/dashboard"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-forest-800 hover:text-clay-700"
            >
              Back to dashboard
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        />
      ) : (
        <section className="card-surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <p className="text-[12px] text-ink-500">
              {notifications.length} recent{" "}
              {notifications.length === 1 ? "notification" : "notifications"} ·{" "}
              <span className="font-medium text-forest-900">
                {unread.length} unread
              </span>
            </p>
            <p className="hidden text-[10.5px] text-ink-400 sm:block">
              Kept for your account only
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Filter notifications"
            >
              {(
                [
                  ["all", "All", notifications.length],
                  ["unread", "Unread", unread.length],
                  ["read", "Read", readCount],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filter === key
                      ? "border-forest-900 bg-forest-900 text-paper-50"
                      : "border-line text-ink-500 hover:border-forest-600 hover:text-forest-800",
                  )}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <p className="text-[10.5px] text-ink-400">
              Showing {visible.length} of {notifications.length}
            </p>
          </div>

          <ul className="divide-y divide-line">
            {visible.map((notification) => {
              const Icon = typeIcons[notification.type];
              const isUnread = !notification.readAt;
              return (
                <li
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 sm:px-5",
                    isUnread && "bg-paper-100/50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      isUnread
                        ? "border-clay-200 bg-clay-50 text-clay-700"
                        : "border-line bg-paper-50 text-ink-500",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p
                        className={cn(
                          "text-[12.5px] leading-5",
                          isUnread
                            ? "font-semibold text-forest-900"
                            : "font-medium text-ink-700",
                        )}
                      >
                        {notification.title}
                      </p>
                      <Badge variant="outline">{typeLabels[notification.type]}</Badge>
                      {isUnread ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-clay-700">
                          <Circle
                            aria-hidden="true"
                            className="size-1.5 fill-clay-500 text-clay-500"
                          />
                          Unread
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-400">Read</span>
                      )}
                    </div>
                    {notification.body && (
                      <p className="mt-1 text-[11.5px] leading-5 text-ink-500">
                        {notification.body}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <span className="text-[10.5px] text-ink-400">
                        {relativeDay(notification.createdAt)}
                      </span>
                      {notification.href && (
                        <Link
                          href={notification.href}
                          onClick={() => {
                            if (isUnread) void markNotificationRead(notification.id);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-forest-800 hover:text-clay-700"
                        >
                          Open
                          <ArrowRight aria-hidden="true" className="size-3" />
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => void toggleRead(notification)}
                        disabled={pendingId === notification.id}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 hover:text-forest-800 disabled:opacity-40"
                      >
                        {pendingId === notification.id && (
                          <LoaderCircle
                            aria-hidden="true"
                            className="size-3 animate-spin"
                          />
                        )}
                        {isUnread ? "Mark as read" : "Mark as unread"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {notifications.length > 0 && visible.length === 0 && (
            <p className="px-4 py-8 text-center text-[12px] text-ink-500 sm:px-5">
              No {filter} notifications right now.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[11px] leading-5 text-ink-400">
          Notifications are listed newest first in pages of 30 — load older ones
          with the button as needed. Email, push and scheduled reminders are not
          enabled in this deployment.
        </p>
        {!olderExhausted && notifications.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <ArrowDown aria-hidden="true" className="size-3.5" />
            )}
            Load older notifications
          </Button>
        )}
      </div>
    </div>
  );
}
