"use client";

import { PageHeader } from "@/components/ui/page-header";
import { InvitationsView } from "@/components/invitations/invitations-view";
import { InlineNotice } from "@/components/ui/feedback";

export default function InvitationsPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Join the group"
        title="Invitations"
        description="Trips you have been invited to, and the people you have invited to yours."
      />

      <InlineNotice variant="info" title="How invitations work">
        Accepting, declining and sending invitations are saved to the database.
        Accepting grants access to that trip only; registered members are
        notified in the app, and an email is sent too when email delivery is
        configured. Invitations expire after 14 days.
      </InlineNotice>

      <InvitationsView />
    </div>
  );
}
