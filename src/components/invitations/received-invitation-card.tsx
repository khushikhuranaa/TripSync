"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, MapPin, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo-store";
import { formatDateRange, daysUntil, formatCount } from "@/lib/format";
import type { Invitation } from "@/lib/types";

export function ReceivedInvitationCard({
  invitation,
  compact = false,
}: {
  invitation: Invitation;
  compact?: boolean;
}) {
  const router = useRouter();
  const { respondToInvitation } = useDemoStore();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const days = daysUntil(invitation.expiresAt);
  const expiry =
    days < 0
      ? "Expired"
      : days === 0
        ? "Expires today"
        : `Expires in ${formatCount(days, "day")}`;
  const isPending = invitation.status === "pending";

  const statusLabel =
    invitation.status === "accepted"
      ? "Accepted — added to your trips"
      : invitation.status === "declined"
        ? "Declined"
        : invitation.status === "expired"
          ? "Expired"
          : "Invitation answered";

  async function accept() {
    if (pending) return;
    setPending("accept");
    const created = await respondToInvitation(invitation.id, "accepted");
    setPending(null);
    if (created) router.push(`/preview/trips/${created.id}`);
  }

  async function decline() {
    if (pending) return;
    setPending("decline");
    await respondToInvitation(invitation.id, "declined");
    setPending(null);
  }

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-card shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-100/60 px-4 py-2.5">
        <Badge variant={isPending ? "clay" : "muted"}>
          <UserRound aria-hidden="true" className="size-3" />
          {isPending ? "Invitation" : "Invitation answered"}
        </Badge>
        <span className="text-[11px] text-ink-500">
          {isPending ? expiry : statusLabel}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="font-display text-[20px] font-semibold leading-snug tracking-[-0.02em] text-forest-900">
          {invitation.tripName}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-500">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          {invitation.destination}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-700">
          <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-ink-400" />
          {formatDateRange(invitation.startDate, invitation.endDate)}
        </p>

        <p className="mt-3.5 text-[12.5px] leading-5 text-ink-500">
          <span className="font-medium text-forest-900">
            {invitation.inviterName}
          </span>{" "}
          invited you
          {invitation.memberCount
            ? ` to a trip with ${formatCount(invitation.memberCount, "traveller")}`
            : ""}
          .
        </p>

        {!compact && isPending && (
          <p className="mt-2 text-[11.5px] leading-5 text-ink-400">
            Accepting adds this trip to your workspace. Membership grants access
            to this trip only, never to the inviter&apos;s other trips.
          </p>
        )}

        {isPending ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending !== null} onClick={accept}>
              <Check aria-hidden="true" className="size-3.5" />
              {pending === "accept" ? "Accepting…" : "Accept invitation"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending !== null}
              onClick={decline}
            >
              <X aria-hidden="true" className="size-3.5" />
              {pending === "decline" ? "Declining…" : "Decline"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-line bg-paper-50 px-3 py-2 text-[11.5px] text-ink-500">
            {statusLabel}. The trip owner has been notified of your response.
          </div>
        )}

        {compact && (
          <Link
            href="/preview/invitations"
            className="mt-3 inline-flex text-[11.5px] font-medium text-forest-800 underline decoration-line-strong underline-offset-4 hover:text-clay-700"
          >
            View all invitations
          </Link>
        )}
      </div>
    </article>
  );
}
