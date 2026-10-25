import { initialsFor, toneForId } from "@/lib/identity";
import { minorToRupees } from "@/lib/money";
import { parseNotificationPreferences } from "@/lib/notifications";
import type {
  AdminUser,
  AppNotification,
  Expense,
  FeedbackEntry,
  Invitation,
  ItineraryItem,
  Member,
  PackingItem,
  PlatformRole,
  Poll,
  Profile,
  Trip,
  TripAccessRole,
  TripActivity,
  TripNote,
} from "@/lib/types";
import type { WorkspaceState } from "@/lib/workspace";
import { getD1 } from "./db";
import { ensureMigrated } from "./migrations";
import {
  template,
  templateExpenses,
  templateItinerary,
  templateNotes,
  templatePacking,
  templatePolls,
} from "./template";

/**
 * A small typed SQL layer.
 *
 * Reads for the workspace are plain parameterised D1 statements: the joins are
 * explicit, every value is bound, and the result is mapped into the domain
 * types the interface already uses.
 */

async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const statement = getD1().prepare(sql);
  const bound = params.length > 0 ? statement.bind(...params) : statement;
  const { results } = await bound.all<T>();
  return results ?? [];
}

async function one<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  const statement = getD1().prepare(sql);
  const bound = params.length > 0 ? statement.bind(...params) : statement;
  return (await bound.first<T>()) ?? null;
}

function isoDateFromMs(value: number | null): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function isoDateTimeFromMs(value: number | null): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}


type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  home_city: string;
  travel_style: string;
  dietary_notes: string;
  notification_prefs: string;
  onboarding_completed_at: number | null;
  created_at: number;
};

type TripRow = {
  id: string;
  owner_id: string;
  name: string;
  destination: string;
  region: string;
  description: string;
  start_date: string;
  end_date: string;
  traveller_count: number | null;
  budget_minor: number | null;
  currency: string;
  cover_image: string;
  cover_alt: string;
  created_at: number;
  updated_at: number;
};

type MemberRow = {
  trip_id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
};

type ItineraryRow = {
  id: string;
  trip_id: string;
  day_date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  place: string;
  address: string | null;
  map_url: string | null;
  reference_url: string | null;
  description: string | null;
  source: string | null;
  cost_minor: number | null;
  category: string;
  created_by: string;
  sort_order: number;
  updated_at: number;
};

type ExpenseRow = {
  id: string;
  trip_id: string;
  description: string;
  amount_minor: number;
  category: string;
  spent_on: string;
  paid_by: string;
  notes: string | null;
  created_at: number;
};

type SplitRow = { expense_id: string; user_id: string; share_minor: number };

type PollRow = {
  id: string;
  trip_id: string;
  question: string;
  description: string;
  created_by: string;
  closes_at: number | null;
  status: string;
};

type PollOptionRow = { id: string; poll_id: string; label: string };
type PollVoteRow = { poll_id: string; option_id: string; user_id: string };

type PackingRow = {
  id: string;
  trip_id: string;
  name: string;
  category: string;
  notes: string | null;
  quantity: number;
  assigned_to: string | null;
  packed: boolean;
};

type NoteRow = {
  id: string;
  trip_id: string;
  author_id: string;
  title: string;
  body: string;
  category: string;
  created_at: number;
  updated_at: number;
};

type InvitationRow = {
  id: string;
  trip_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_name: string;
  role: string;
  token: string;
  status: string;
  created_at: number;
  expires_at: number;
  inviter_name: string;
  trip_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  member_count: number;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read_at: number | null;
  created_at: number;
};

function accessFor(role: string): TripAccessRole {
  return role === "owner" || role === "viewer" ? role : "editor";
}

function mapMember(row: MemberRow, currentUserId: string): Member {
  const access = accessFor(row.role);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    initials: initialsFor(row.name),
    tone: toneForId(row.user_id),
    role: access === "owner" ? "owner" : "member",
    access,
    isCurrentUser: row.user_id === currentUserId,
  };
}

/** Build a query that fetches members for every trip in `ids`. */
async function membersByTrip(ids: string[]): Promise<Map<string, MemberRow[]>> {
  const grouped = new Map<string, MemberRow[]>();
  if (ids.length === 0) return grouped;

  // D1 caps bound parameters, so read in small batches.
  const chunkSize = 40;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await all<MemberRow>(
      `select m.trip_id, m.user_id, m.role, u.name, u.email
       from trip_members m join "user" u on u.id = m.user_id
       where m.trip_id in (${placeholders})
       order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, u.name`,
      ...chunk,
    );
    for (const row of rows) {
      const list = grouped.get(row.trip_id) ?? [];
      list.push(row);
      grouped.set(row.trip_id, list);
    }
  }
  return grouped;
}

function mapTrip(
  row: TripRow,
  members: MemberRow[],
  currentUserId: string,
): Trip {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    region: row.region,
    startDate: row.start_date,
    endDate: row.end_date,
    travellerCount: row.traveller_count,
    description: row.description,
    budget: row.budget_minor === null ? null : minorToRupees(row.budget_minor),
    currency: "INR",
    coverImage: row.cover_image,
    coverAlt: row.cover_alt,
    ownerId: row.owner_id,
    members: members.map((member) => mapMember(member, currentUserId)),
    createdAt: isoDateFromMs(row.created_at),
    createdMs: row.created_at,
    updatedMs: row.updated_at,
  };
}

async function loadTrips(rows: TripRow[], currentUserId: string) {
  const members = await membersByTrip(rows.map((row) => row.id));
  return rows.map((row) => mapTrip(row, members.get(row.id) ?? [], currentUserId));
}

/** How much history each trip carries into the workspace snapshot. */
const ACTIVITY_PER_TRIP = 12;

/**
 * Recent activity for every trip the user belongs to.
 *
 * Only trips the caller is a member of are queried, so history never leaks
 * across trips. The actor name is joined in; a deleted account leaves the event
 * in place with no name rather than erasing what happened.
 */
async function activityByTrip(ids: string[]): Promise<Map<string, TripActivity[]>> {
  const grouped = new Map<string, TripActivity[]>();
  if (ids.length === 0) return grouped;

  const chunkSize = 40;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await all<{
      id: string;
      trip_id: string;
      kind: string;
      summary: string;
      actor_name: string | null;
      created_at: number;
    }>(
      `select a.id, a.trip_id, a.kind, a.summary, u.name as actor_name, a.created_at
       from trip_activity a left join "user" u on u.id = a.actor_id
       where a.trip_id in (${placeholders})
       order by a.created_at desc`,
      ...chunk,
    );
    for (const row of rows) {
      const list = grouped.get(row.trip_id) ?? [];
      if (list.length >= ACTIVITY_PER_TRIP) continue;
      list.push({
        id: row.id,
        kind: row.kind,
        summary: row.summary,
        actorName: row.actor_name ?? undefined,
        createdAt: new Date(row.created_at).toISOString(),
      });
      grouped.set(row.trip_id, list);
    }
  }
  return grouped;
}

function mapInvitation(
  row: InvitationRow,
  kind: Invitation["kind"],
  now: number,
): Invitation {
  let status: Invitation["status"] = "pending";
  if (row.status === "accepted") status = "accepted";
  else if (row.status === "declined" || row.status === "revoked") status = "declined";
  else if (row.status === "expired" || row.expires_at < now) status = "expired";

  return {
    id: row.id,
    token: row.token,
    role: accessFor(row.role),
    tripId: row.trip_id,
    tripName: row.trip_name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    inviterName: row.inviter_name,
    inviteeName: row.invitee_name || row.invitee_email.split("@")[0],
    inviteeEmail: row.invitee_email,
    memberCount: row.member_count,
    status,
    sentAt: isoDateFromMs(row.created_at),
    expiresAt: isoDateFromMs(row.expires_at),
    kind,
  };
}

const INVITATION_SELECT = `
  select i.id, i.trip_id, i.inviter_id, i.invitee_email, i.invitee_name, i.role,
         i.token, i.status, i.created_at, i.expires_at,
         u.name as inviter_name, t.name as trip_name, t.destination,
         t.start_date, t.end_date,
         (select count(*) from trip_members m where m.trip_id = t.id) as member_count
  from trip_invitations i
  join "user" u on u.id = i.inviter_id
  join trips t on t.id = i.trip_id
`;

async function loadNotifications(userId: string): Promise<AppNotification[]> {
  const rows = await all<NotificationRow>(
    `select id, type, title, body, href, read_at, created_at
     from notifications where user_id = ?
     order by created_at desc limit 30`,
    userId,
  );
  return rows.map(notificationFromRow);
}

function notificationFromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: (row.type as AppNotification["type"]) ?? "membership",
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    readAt: isoDateTimeFromMs(row.read_at),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * The next page of notifications, strictly older than `beforeMs`. Used by the
 * "Load older" control so history beyond the most recent 30 stays reachable
 * without ever widening the workspace snapshot.
 */
async function loadNotificationsBefore(
  userId: string,
  beforeMs: number,
): Promise<AppNotification[]> {
  const rows = await all<NotificationRow>(
    `select id, type, title, body, href, read_at, created_at
     from notifications where user_id = ? and created_at < ?
     order by created_at desc limit 30`,
    userId,
    beforeMs,
  );
  return rows.map(notificationFromRow);
}

async function loadAdminData(user: UserRow) {
  if (user.role !== "admin") {
    return { users: [] as AdminUser[], feedback: [] as FeedbackEntry[], adminTrips: [] as Trip[] };
  }

  const users = await all<
    UserRow & { trip_count: number }
  >(
    `select u.id, u.name, u.email, u.role, u.home_city, u.travel_style,
            u.dietary_notes, u.notification_prefs, u.onboarding_completed_at,
            u.created_at,
            (select count(*) from trip_members m where m.user_id = u.id) as trip_count
     from "user" u order by u.created_at asc`,
  );

  const feedback = await all<
    FeedbackRow & { author_name: string; author_email: string }
  >(
    `select f.id, f.rating, f.message, f.created_at, u.name as author_name, u.email as author_email
     from feedback f join "user" u on u.id = f.user_id
     order by f.created_at desc limit 200`,
  );

  const tripRows = await all<TripRow>(
    `select * from trips order by start_date asc limit 200`,
  );

  return {
    users: users.map<AdminUser>((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: (row.role === "admin" ? "admin" : "user") as PlatformRole,
      tripCount: row.trip_count,
      joinedAt: isoDateFromMs(row.created_at),
      status: "Active",
    })),
    feedback: feedback.map<FeedbackEntry>((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.message,
      createdAt: new Date(row.created_at).toISOString(),
      authorName: row.author_name,
      authorEmail: row.author_email,
    })),
    adminTrips: await loadTrips(tripRows, user.id),
  };
}

type FeedbackRow = { id: string; rating: number; message: string; created_at: number };

/**
 * Load everything the user may see. Every query is scoped to the user or to
 * trips they are a member of; there is no "select all" path for normal users.
 */
export async function loadWorkspace(userId: string): Promise<WorkspaceState> {
  // Belt and braces: every workspace read funnels through here.
  await ensureMigrated(getD1());
  const user = await one<UserRow>(
    `select id, name, email, role, home_city, travel_style, dietary_notes,
            notification_prefs, onboarding_completed_at, created_at
     from "user" where id = ?`,
    userId,
  );
  if (!user) {
    throw new Error("That account no longer exists.");
  }

  const tripRows = await all<TripRow>(
    `select t.* from trips t
     join trip_members m on m.trip_id = t.id
     where m.user_id = ?
     order by t.start_date asc`,
    userId,
  );
  const trips = await loadTrips(tripRows, userId);
  const tripIds = tripRows.map((row) => row.id);

  const activity = await activityByTrip(tripIds);
  for (const trip of trips) {
    trip.activity = activity.get(trip.id) ?? [];
  }

  const itinerary: ItineraryItem[] = [];
  const expenses: Expense[] = [];
  const polls: Poll[] = [];
  const packingItems: PackingItem[] = [];
  const notes: TripNote[] = [];

  if (tripIds.length > 0) {
    const placeholders = tripIds.map(() => "?").join(", ");

    const itineraryRows = await all<ItineraryRow>(
      `select * from itinerary_items where trip_id in (${placeholders})
       order by day_date, sort_order, start_time`,
      ...tripIds,
    );
    for (const row of itineraryRows) {
      itinerary.push({
        id: row.id,
        tripId: row.trip_id,
        date: row.day_date,
        startTime: row.start_time,
        endTime: row.end_time ?? undefined,
        title: row.title,
        description: row.description ?? undefined,
        source: row.source === "ai" ? "ai" : "manual",
        location: row.place,
        address: row.address ?? undefined,
        mapUrl: row.map_url ?? undefined,
        referenceUrl: row.reference_url ?? undefined,
        estimatedCost:
          row.cost_minor === null ? undefined : minorToRupees(row.cost_minor),
        category: row.category as ItineraryItem["category"],
        createdBy: row.created_by,
        sortOrder: row.sort_order,
        updatedMs: row.updated_at,
      });
    }

    const expenseRows = await all<ExpenseRow>(
      `select * from expenses where trip_id in (${placeholders}) order by spent_on desc, created_at desc`,
      ...tripIds,
    );
    const splitRows = await all<SplitRow>(
      `select s.expense_id, s.user_id, s.share_minor
       from expense_splits s join expenses e on e.id = s.expense_id
       where e.trip_id in (${placeholders}) order by s.expense_id, s.user_id`,
      ...tripIds,
    );
    const participants = new Map<string, string[]>();
    const splitShares = new Map<string, Record<string, number>>();
    for (const split of splitRows) {
      const list = participants.get(split.expense_id) ?? [];
      list.push(split.user_id);
      participants.set(split.expense_id, list);
      const shares = splitShares.get(split.expense_id) ?? {};
      shares[split.user_id] = minorToRupees(split.share_minor);
      splitShares.set(split.expense_id, shares);
    }
    for (const row of expenseRows) {
      expenses.push({
        id: row.id,
        tripId: row.trip_id,
        description: row.description,
        amount: minorToRupees(row.amount_minor),
        category: row.category as Expense["category"],
        date: row.spent_on,
        payerId: row.paid_by,
        participantIds: participants.get(row.id) ?? [],
        notes: row.notes ?? undefined,
        shares: splitShares.get(row.id),
      });
    }

    const pollRows = await all<PollRow>(
      `select * from polls where trip_id in (${placeholders}) order by created_at desc`,
      ...tripIds,
    );
    const optionRows = await all<PollOptionRow>(
      `select o.id, o.poll_id, o.label from poll_options o
       join polls p on p.id = o.poll_id where p.trip_id in (${placeholders})
       order by o.sort_order`,
      ...tripIds,
    );
    const voteRows = await all<PollVoteRow>(
      `select v.poll_id, v.option_id, v.user_id from poll_votes v
       join polls p on p.id = v.poll_id where p.trip_id in (${placeholders})`,
      ...tripIds,
    );
    for (const row of pollRows) {
      const closedByDate = row.closes_at !== null && row.closes_at < Date.now();
      polls.push({
        id: row.id,
        tripId: row.trip_id,
        question: row.question,
        description: row.description || undefined,
        createdBy: row.created_by,
        closesAt: isoDateTimeFromMs(row.closes_at),
        status:
          row.status === "closed"
            ? "closed"
            : closedByDate
              ? "expired"
              : "open",
        options: optionRows
          .filter((option) => option.poll_id === row.id)
          .map((option) => ({
            id: option.id,
            label: option.label,
            voterIds: voteRows
              .filter((vote) => vote.option_id === option.id)
              .map((vote) => vote.user_id),
          })),
      });
    }

    const packingRows = await all<PackingRow>(
      `select * from packing_items where trip_id in (${placeholders})
       order by sort_order, created_at`,
      ...tripIds,
    );
    for (const row of packingRows) {
      packingItems.push({
        id: row.id,
        tripId: row.trip_id,
        name: row.name,
        quantity: row.quantity,
        packed: row.packed,
        assignedTo: row.assigned_to ?? undefined,
        category: row.category as PackingItem["category"],
        notes: row.notes ?? undefined,
      });
    }

    const noteRows = await all<NoteRow>(
      `select * from trip_notes where trip_id in (${placeholders}) order by updated_at desc`,
      ...tripIds,
    );
    for (const row of noteRows) {
      notes.push({
        id: row.id,
        tripId: row.trip_id,
        authorId: row.author_id,
        title: row.title,
        body: row.body,
        category: row.category as TripNote["category"],
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      });
    }
  }

  const now = Date.now();
  const received = await all<InvitationRow>(
    `${INVITATION_SELECT} where lower(i.invitee_email) = lower(?)
     order by i.created_at desc limit 50`,
    user.email,
  );
  const sent = await all<InvitationRow>(
    `${INVITATION_SELECT} where i.inviter_id = ? order by i.created_at desc limit 50`,
    userId,
  );

  const admin = await loadAdminData(user);

  const profile: Profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: initialsFor(user.name),
    tone: toneForId(user.id),
    platformRole: user.role === "admin" ? "admin" : "user",
    homeCity: user.home_city,
    joinedAt: isoDateFromMs(user.created_at),
    travelStyle:
      user.travel_style === "Relaxed" || user.travel_style === "Packed"
        ? user.travel_style
        : "Balanced",
    dietaryNotes: user.dietary_notes,
    notificationPreferences: parseNotificationPreferences(user.notification_prefs),
    onboardingCompletedAt: isoDateTimeFromMs(user.onboarding_completed_at),
  };

  // The curated example trip is merged in for display. Its records are never
  // written to the database and every mutation of it is rejected on the server.
  return {
    trips: [...trips, template],
    itinerary: [...itinerary, ...templateItinerary],
    expenses: [...expenses, ...templateExpenses],
    polls: [...polls, ...templatePolls],
    packingItems: [...packingItems, ...templatePacking],
    notes: [...notes, ...templateNotes],
    invitations: [
      ...received.map((row) => mapInvitation(row, "received", now)),
      ...sent.map((row) => mapInvitation(row, "sent", now)),
    ],
    profile,
    users: admin.users,
    feedback: admin.feedback,
    adminTrips: admin.adminTrips,
    notifications: await loadNotifications(userId),
  };
}

export { loadNotificationsBefore };

/** The user's stored email, used for invitation matching. */
export async function getUserEmail(userId: string) {
  const row = await one<{ email: string }>(`select email from "user" where id = ?`, userId);
  return row?.email ?? null;
}
