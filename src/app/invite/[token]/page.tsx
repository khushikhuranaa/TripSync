import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { InlineNotice } from "@/components/ui/feedback";
import { InvitationResponse } from "@/components/invitations/invitation-response";
import { formatDate, formatDateRange, formatCount } from "@/lib/format";
import { getSessionUser } from "@/server/auth";
import { loadInvitationPreview } from "@/server/invitations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trip invitation",
  description: "Review a TripSync trip invitation and accept or decline it.",
  robots: { index: false, follow: false },
};

/**
 * The public entry point for an invitation link.
 *
 * The token is validated on the server before anything is rendered. Opening the
 * link grants nothing: the page only shows the trip name, dates, destination,
 * inviter and the role on offer. Access is created by the accept action, which
 * requires a signed-in account whose verified email matches the invitation.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await loadInvitationPreview(token);
  const user = await getSessionUser();

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-paper-50">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-14 pt-6 sm:px-6 sm:pt-10">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="TripSync home" className="inline-flex">
            <Logo />
          </Link>
          <Link
            href={user ? "/preview/dashboard" : "/sign-in"}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            {user ? "My workspace" : "Sign in"}
          </Link>
        </header>

        <main id="main" className="mt-8">
          {children}
        </main>

        <p className="mt-8 border-t border-line pt-4 text-[10.5px] leading-5 text-ink-400">
          Invitation links are personal and expire. TripSync never adds a trip to
          your workspace until you accept, and your access is limited to that one
          trip.
        </p>
      </div>
    </div>
  );

  if (!invitation) {
    return shell(
      <div className="rounded-xl border border-line bg-card p-6 shadow-soft">
        <span className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper-100 text-clay-600">
          <ShieldAlert aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.02em] text-forest-900">
          This invitation link isn&apos;t valid
        </h1>
        <p className="mt-2 text-[12.5px] leading-6 text-ink-500">
          The link may have been copied incompletely, or the invitation may have
          been withdrawn. Ask the trip owner to send a fresh invitation — nothing
          was changed on your account.
        </p>
      </div>,
    );
  }

  const roleLabel =
    invitation.role === "viewer"
      ? "Viewer — you can see the trip and itinerary"
      : "Editor — you can add and change activities";

  const summary = (
    <div className="rounded-xl border border-line bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="clay">
          <UserRound aria-hidden="true" className="size-3" />
          Trip invitation
        </Badge>
        <Badge variant="sage">
          {invitation.role === "viewer" ? "Viewer" : "Editor"}
        </Badge>
      </div>

      <h1 className="mt-3.5 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-forest-900 sm:text-[29px]">
        {invitation.inviterName.split(" ")[0]} invited you to{" "}
        {invitation.tripName}
      </h1>

      <dl className="mt-4 space-y-2 text-[12px] text-ink-600">
        <div className="flex items-start gap-2">
          <MapPin
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-ink-400"
          />
          <div>
            <dt className="sr-only">Destination</dt>
            <dd>{invitation.destination}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CalendarDays
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-ink-400"
          />
          <div>
            <dt className="sr-only">Dates</dt>
            <dd>
              {formatDateRange(invitation.startDate, invitation.endDate)}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Users
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-ink-400"
          />
          <div>
            <dt className="sr-only">Members</dt>
            <dd>{formatCount(invitation.memberCount, "traveller")} already on the trip</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-ink-400"
          />
          <div>
            <dt className="sr-only">Expires</dt>
            <dd>
              Expires{" "}
              {formatDate(new Date(invitation.expiresAt).toISOString().slice(0, 10))}
            </dd>
          </div>
        </div>
      </dl>

      <p className="mt-4 rounded-lg border border-line bg-paper-100/70 px-3 py-2.5 text-[11.5px] leading-5 text-ink-600">
        {roleLabel}. Once you accept, this trip appears in your workspace
        alongside your own trips.
      </p>
    </div>
  );

  if (invitation.status !== "pending") {
    const copy =
      invitation.status === "expired"
        ? {
            title: "This invitation has expired",
            body: "Invitations stay open for 14 days. Ask the owner to send a new one and it will work exactly the same way.",
          }
        : invitation.status === "accepted"
          ? {
              title: "This invitation has already been accepted",
              body: "It has been used once already. If the trip is missing from your workspace, ask the owner to check your role on that trip.",
            }
          : invitation.status === "revoked"
            ? {
                title: "This invitation was withdrawn",
                body: "The owner cancelled it before it was accepted, so no access was granted.",
              }
            : {
                title: "This invitation was declined",
                body: "It can no longer be accepted. The owner can send a fresh invitation if you change your mind.",
              };

    return shell(
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-card p-5 shadow-soft sm:p-6">
          <Badge variant="muted">{invitation.tripName}</Badge>
          <h1 className="mt-3 font-display text-[24px] font-semibold tracking-[-0.02em] text-forest-900">
            {copy.title}
          </h1>
          <p className="mt-2 text-[12.5px] leading-6 text-ink-500">{copy.body}</p>
          {invitation.status === "accepted" && (
            <Link
              href={`/preview/trips/${invitation.tripId}`}
              className={buttonStyles({ size: "md", className: "mt-4" })}
            >
              Open {invitation.tripName}
            </Link>
          )}
        </div>
      </div>,
    );
  }

  const next = `/invite/${token}`;
  const matchesInvitee =
    Boolean(user) &&
    user!.email.toLowerCase() === invitation.inviteeEmail.toLowerCase();

  return shell(
    <div className="space-y-4">
      {summary}

      {!user ? (
        <div className="rounded-xl border border-line bg-card p-5 shadow-soft">
          <h2 className="text-[13.5px] font-semibold text-forest-900">
            Sign in to accept
          </h2>
          <p className="mt-1.5 text-[12px] leading-6 text-ink-500">
            This invitation was sent to{" "}
            <span className="font-medium text-ink-700">
              {invitation.inviteeEmail}
            </span>
            . Sign in with that address, or create a free account with it, to
            join the trip.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/sign-in?next=${encodeURIComponent(next)}`}
              className={buttonStyles({ size: "md" })}
            >
              Sign in to accept
            </Link>
            <Link
              href={`/sign-up?next=${encodeURIComponent(next)}`}
              className={buttonStyles({ variant: "secondary", size: "md" })}
            >
              Create an account
            </Link>
          </div>
        </div>
      ) : matchesInvitee ? (
        <div className="rounded-xl border border-line bg-card p-5 shadow-soft">
          <h2 className="text-[13.5px] font-semibold text-forest-900">
            Join {invitation.tripName}?
          </h2>
          <p className="mt-1.5 text-[12px] leading-6 text-ink-500">
            You are signed in as {user.email}. Accepting adds this trip to your
            workspace with the role shown above.
          </p>
          <div className="mt-4">
            <InvitationResponse
              token={token}
              signedInEmail={user.email}
            />
          </div>
        </div>
      ) : (
        <InlineNotice
          variant="warning"
          title="This invitation is for a different account"
        >
          It was sent to {invitation.inviteeEmail}, but you are signed in as{" "}
          {user.email}. Sign out and sign in with the invited address to answer
          it. Nothing was changed.
          <div className="mt-3">
            <InvitationResponse
              token={token}
              signedInEmail={user.email}
              allowResponse={false}
            />
          </div>
        </InlineNotice>
      )}
    </div>,
  );
}
