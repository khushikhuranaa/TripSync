"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Mail, Send } from "lucide-react";
import { ReceivedInvitationCard } from "@/components/invitations/received-invitation-card";
import { SentInvitationRow } from "@/components/invitations/sent-invitation-row";
import { SendInvitationDialog } from "@/components/invitations/send-invitation-dialog";
import { EmptyState } from "@/components/ui/feedback";
import { useDemoStore } from "@/lib/demo-store";

export function InvitationsView() {
  const { state } = useDemoStore();
  const received = state.invitations.filter(
    (invitation) => invitation.kind === "received",
  );
  const sent = state.invitations.filter(
    (invitation) => invitation.kind === "sent",
  );

  return (
    <Tabs.Root defaultValue="received">
      <Tabs.List
        aria-label="Invitation direction"
        className="flex items-center gap-1 border-b border-line"
      >
        <Tabs.Trigger
          value="received"
          className="relative inline-flex h-11 items-center gap-2 px-3 text-[13px] font-medium text-ink-500 transition-colors hover:text-forest-800 data-[state=active]:text-forest-900 data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-clay-500"
        >
          <Mail aria-hidden="true" className="size-4" />
          Received
          <span className="rounded-full bg-paper-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-500">
            {received.length}
          </span>
        </Tabs.Trigger>
        <Tabs.Trigger
          value="sent"
          className="relative inline-flex h-11 items-center gap-2 px-3 text-[13px] font-medium text-ink-500 transition-colors hover:text-forest-800 data-[state=active]:text-forest-900 data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-clay-500"
        >
          <Send aria-hidden="true" className="size-4" />
          Sent
          <span className="rounded-full bg-paper-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-500">
            {sent.length}
          </span>
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="received" className="mt-5 focus:outline-none">
        {received.length > 0 ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {received.map((invitation) => (
                <ReceivedInvitationCard
                  key={invitation.id}
                  invitation={invitation}
                />
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-ink-400">
              Accepting an invitation adds that trip to your workspace. It never
              gives access to the inviter&apos;s other trips.
            </p>
          </>
        ) : (
          <EmptyState
            icon={Mail}
            title="No invitations waiting"
            description="When someone invites you to a trip, it will appear here with the dates, destination and who sent it."
          />
        )}
      </Tabs.Content>

      <Tabs.Content value="sent" className="mt-5 focus:outline-none">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-[12px] leading-5 text-ink-500">
            Pending invitations can be reviewed here. Accepted invitations grant
            access to that trip only. Emails go out when email delivery is
            configured; otherwise registered members are notified in the app.
          </p>
          <SendInvitationDialog />
        </div>

        {sent.length > 0 ? (
          <div className="rounded-xl border border-line bg-card px-4 shadow-soft sm:px-5">
            {sent.map((invitation) => (
              <SentInvitationRow key={invitation.id} invitation={invitation} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Send}
            title="No invitations sent"
            description="Invite a teammate by email from a trip you own. The invitation will be recorded as a pending demo preview."
            action={<SendInvitationDialog />}
          />
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}
