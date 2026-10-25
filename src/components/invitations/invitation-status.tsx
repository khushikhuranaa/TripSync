import { Badge } from "@/components/ui/badge";
import type { InvitationStatus } from "@/lib/types";

const statusMap: Record<
  InvitationStatus,
  { label: string; variant: "sage" | "clay" | "muted" }
> = {
  pending: { label: "Pending", variant: "clay" },
  accepted: { label: "Accepted", variant: "sage" },
  declined: { label: "Declined", variant: "muted" },
  expired: { label: "Expired", variant: "muted" },
};

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const config = statusMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
