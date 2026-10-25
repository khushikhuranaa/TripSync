import { getD1 } from "./db";

/**
 * Everything an invitation page may show *before* the recipient accepts.
 *
 * The itinerary, expenses, notes and member list are deliberately absent: the
 * token proves only that someone was invited, not that they may read the trip.
 */
export type InvitationPreview = {
  id: string;
  tripId: string;
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  role: "editor" | "viewer";
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  inviterName: string;
  inviteeEmail: string;
  memberCount: number;
  expiresAt: number;
};

type PreviewRow = {
  id: string;
  trip_id: string;
  status: string;
  role: string;
  invitee_email: string;
  expires_at: number;
  trip_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  inviter_name: string;
  member_count: number;
};

/** Invitation links are random 256-bit hex strings; anything else is refused
 * before it reaches the database. */
export function isWellFormedToken(token: string) {
  return /^[a-f0-9]{32,96}$/i.test(token);
}

/**
 * Looks an invitation up by its token. Returns `null` for an unknown or
 * malformed token, and folds an un-converted expired invitation into the
 * `expired` status so the page never offers to accept something stale.
 */
export async function loadInvitationPreview(
  token: string,
): Promise<InvitationPreview | null> {
  if (!isWellFormedToken(token)) return null;

  const row = await getD1()
    .prepare(
      `select i.id, i.trip_id, i.status, i.role, i.invitee_email, i.expires_at,
              t.name as trip_name, t.destination, t.start_date, t.end_date,
              u.name as inviter_name,
              (select count(*) from trip_members m where m.trip_id = t.id) as member_count
       from trip_invitations i
       join trips t on t.id = i.trip_id
       join user u on u.id = i.inviter_id
       where i.token = ?`,
    )
    .bind(token)
    .first<PreviewRow>();
  if (!row) return null;

  const stored =
    row.status === "accepted" ||
    row.status === "declined" ||
    row.status === "revoked"
      ? row.status
      : row.expires_at < Date.now()
        ? "expired"
        : "pending";

  return {
    id: row.id,
    tripId: row.trip_id,
    status: stored,
    role: row.role === "viewer" ? "viewer" : "editor",
    tripName: row.trip_name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    inviterName: row.inviter_name,
    inviteeEmail: row.invitee_email,
    memberCount: row.member_count,
    expiresAt: row.expires_at,
  };
}
