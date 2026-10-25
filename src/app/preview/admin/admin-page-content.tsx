"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { InlineNotice } from "@/components/ui/feedback";
import { AdminView, type AdminTripEntry } from "@/components/admin/admin-view";
import { useDemoStore } from "@/lib/demo-store";
import { formatCount, tripStatus } from "@/lib/format";

export default function AdminPageContent() {
  const { state } = useDemoStore();
  // adminTrips is filled only for platform admins; everyone else sees none.
  const tripEntries: AdminTripEntry[] = state.adminTrips.map((trip) => ({
    trip,
    status: tripStatus(trip),
  }));
  const pendingInvitations = state.invitations.filter(
    (invitation) => invitation.status === "pending" && invitation.kind === "sent",
  ).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Restricted area"
        title="Platform overview"
        description="Basic user, trip and feedback oversight for accounts explicitly assigned the platform admin role."
        actions={
          <Badge variant="clay">
            <ShieldCheck aria-hidden="true" className="size-3" />
            Admin preview
          </Badge>
        }
      />

      <InlineNotice variant="warning" title="Restricted by role on the server">
        <span className="flex items-start gap-2">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-clay-600"
          />
          <span>
            Only platform admins can open this page — everyone else is
            redirected before it renders. The accounts, trips and feedback shown
            here, plus every role change, are checked again on the server, so a
            forged request from the browser grants nothing.
          </span>
        </span>
      </InlineNotice>

      <section
        aria-label="Demo platform totals"
        className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3"
      >
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Accounts
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(state.users.length, "account")}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Trips on platform
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(tripEntries.length, "trip")}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Pending invitations
          </p>
          <p className="mt-1 text-[15px] font-semibold text-forest-900">
            {formatCount(pendingInvitations, "invitation")}
          </p>
        </div>
      </section>

      <AdminView
        users={state.users}
        tripEntries={tripEntries}
        feedback={state.feedback}
      />

      <p className="text-[11px] leading-5 text-ink-400">
        These are real accounts and trips on this TripSync deployment, loaded
        from the database and visible only to platform admins. Trip counts
        reflect actual memberships.
      </p>
    </div>
  );
}
