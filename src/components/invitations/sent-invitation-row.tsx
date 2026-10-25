import { Avatar } from "@/components/ui/avatar";
import { InvitationStatusBadge } from "@/components/invitations/invitation-status";
import { formatDate, formatDateRange } from "@/lib/format";
import type { Invitation } from "@/lib/types";

const tones = ["clay", "sage", "sand", "forest", "ink"] as const;

export function SentInvitationRow({ invitation }: { invitation: Invitation }) {
  const initials = invitation.inviteeName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <Avatar
        member={{
          name: invitation.inviteeName,
          initials,
          tone: tones[invitation.inviteeName.length % tones.length],
        }}
        size="md"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13.5px] font-semibold text-forest-900">
            {invitation.inviteeName}
          </p>
          <InvitationStatusBadge status={invitation.status} />
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
          {invitation.inviteeEmail}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-500">
          {invitation.tripName} · {formatDateRange(invitation.startDate, invitation.endDate)}
        </p>
      </div>

      <div className="shrink-0 text-[11px] text-ink-400 sm:text-right">
        <p>Sent {formatDate(invitation.sentAt, { year: undefined })}</p>
        <p className="mt-0.5">
          {invitation.status === "pending"
            ? `Expires ${formatDate(invitation.expiresAt, { year: undefined })}`
            : invitation.status === "accepted"
              ? "Joined the trip"
              : "No access granted"}
        </p>
      </div>
    </div>
  );
}
