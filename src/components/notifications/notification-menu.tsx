"use client";

import { useState } from "react";
import Link from "next/link";
import {
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
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

export function NotificationMenu() {
  const { state, markNotificationRead, markNotificationUnread, markAllNotificationsRead } =
    useDemoStore();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const notifications = state.notifications;
  const unread = notifications.filter((item) => !item.readAt);

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-forest-800"
          aria-label={
            unread.length > 0
              ? `Notifications, ${unread.length} unread`
              : "Notifications"
          }
        >
          <Bell aria-hidden="true" className="size-4" />
          {unread.length > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-clay-500 px-1 text-[9px] font-semibold leading-4 text-white ring-2 ring-paper-50"
            >
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
          <div>
            <p className="text-[12.5px] font-semibold text-forest-900">
              Notifications
            </p>
            <p className="text-[10.5px] text-ink-400">
              {unread.length === 0
                ? "You are all caught up."
                : `${unread.length} unread`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => void markAll()}
            disabled={unread.length === 0 || markingAll}
          >
            {markingAll ? (
              <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
            ) : (
              <CheckCheck aria-hidden="true" className="size-3" />
            )}
            Mark all read
          </Button>
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-[11.5px] leading-5 text-ink-500">
              Invitations, polls and trip updates will appear here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type];
                const isUnread = !notification.readAt;
                const body = (
                  <>
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border",
                        isUnread
                          ? "border-clay-200 bg-clay-50 text-clay-700"
                          : "border-line bg-paper-50 text-ink-500",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-1.5">
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-[12px] leading-4",
                            isUnread
                              ? "font-semibold text-forest-900"
                              : "font-medium text-ink-700",
                          )}
                        >
                          {notification.title}
                        </span>
                        {isUnread && (
                          <Circle
                            aria-label="Unread"
                            className="mt-1 size-1.5 shrink-0 fill-clay-500 text-clay-500"
                          />
                        )}
                      </span>
                      {notification.body && (
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-ink-500">
                          {notification.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[10px] text-ink-400">
                        {typeLabels[notification.type]} ·{" "}
                        {relativeDay(notification.createdAt)}
                      </span>
                    </span>
                  </>
                );

                return (
                  <li
                    key={notification.id}
                    className={cn(
                      "group flex items-start gap-2 rounded-lg px-1.5 py-1.5",
                      isUnread ? "bg-paper-100/80" : "hover:bg-paper-50",
                    )}
                  >
                    {notification.href ? (
                      <Link
                        href={notification.href}
                        onClick={() => {
                          if (isUnread) void markNotificationRead(notification.id);
                        }}
                        className="flex min-w-0 flex-1 items-start gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isUnread) void markNotificationRead(notification.id);
                        }}
                        className="flex min-w-0 flex-1 items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500"
                      >
                        {body}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggleRead(notification)}
                      disabled={pendingId === notification.id}
                      aria-label={
                        isUnread
                          ? `Mark "${notification.title}" as read`
                          : `Mark "${notification.title}" as unread`
                      }
                      title={isUnread ? "Mark as read" : "Mark as unread"}
                      className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-300 hover:bg-paper-100 hover:text-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 disabled:opacity-40"
                    >
                      {pendingId === notification.id ? (
                        <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
                      ) : (
                        <CheckCheck aria-hidden="true" className="size-3.5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-line px-2 py-1.5">
          <Link
            href="/preview/notifications"
            className="flex items-center justify-center rounded-md px-2 py-1.5 text-[11.5px] font-medium text-forest-800 hover:bg-paper-100"
          >
            Open notification history
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
