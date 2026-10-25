import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Database schema for the whole application (Supabase Postgres).
 *
 * - every money amount is stored as an integer number of paise (minor units)
 *   and only converted to rupees when it reaches the interface;
 * - fixed sets of values are validated in `src/server/validation.ts`.
 *
 * The four `user`/`session`/`account`/`verification` tables are the ones the
 * Better Auth library owns. `role` and the profile fields are extra columns
 * this app reads; only the server can change `role`.
 */

/**
 * Timestamps: epoch milliseconds stored in a bigint column — the same layout
 * the original SQLite schema used — exposed to Drizzle and Better Auth as a
 * `Date`. Keeping the storage format identical is what lets every raw
 * parameterised statement in the app bind and read plain numbers, unchanged.
 */
const msDate = customType<{ data: Date; driverData: number }>({
  dataType: () => "bigint",
  toDriver: (value) =>
    value instanceof Date ? value.getTime() : Number(value),
  fromDriver: (value) => new Date(Number(value)),
});

// ---------------------------------------------------------------------------
// Authentication and profiles (Better Auth + app profile fields)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .notNull()
    .default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  homeCity: text("home_city").notNull().default(""),
  travelStyle: text("travel_style").notNull().default("Balanced"),
  dietaryNotes: text("dietary_notes").notNull().default(""),
  /** JSON object of in-app notification switches; empty means all enabled. */
  notificationPrefs: text("notification_prefs").notNull().default(""),
  /** When the first-run tour was completed or skipped. Null means show it. */
  onboardingCompletedAt: msDate("onboarding_completed_at"),
  /** Set by the Better Auth two-factor plugin once TOTP is confirmed. */
  twoFactorEnabled: boolean("two_factor_enabled")
    .notNull()
    .default(false),
  createdAt: msDate("created_at").notNull(),
  updatedAt: msDate("updated_at").notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: msDate("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: msDate("created_at").notNull(),
    updatedAt: msDate("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: msDate("access_token_expires_at"),
    refreshTokenExpiresAt: msDate("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: msDate("created_at").notNull(),
    updatedAt: msDate("updated_at").notNull(),
  },
  (table) => [index("account_user_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: msDate("expires_at").notNull(),
    createdAt: msDate("created_at").notNull(),
    updatedAt: msDate("updated_at").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Trips and membership
// ---------------------------------------------------------------------------

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    destination: text("destination").notNull(),
    region: text("region").notNull().default(""),
    description: text("description").notNull().default(""),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    /** Planned party size; accounts that joined are counted in trip_members. */
    travellerCount: integer("traveller_count"),
    budgetMinor: integer("budget_minor"),
    currency: text("currency").notNull().default("INR"),
    coverImage: text("cover_image").notNull().default(""),
    coverAlt: text("cover_alt").notNull().default(""),
    createdAt: msDate("created_at").notNull(),
    updatedAt: msDate("updated_at").notNull(),
  },
  (table) => [
    index("trips_owner_idx").on(table.ownerId),
    index("trips_start_idx").on(table.startDate),
  ],
);

export const tripMembers = pgTable(
  "trip_members",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"),
    joinedAt: msDate("joined_at").notNull(),
  },
  (table) => [
    uniqueIndex("trip_members_trip_user_idx").on(table.tripId, table.userId),
    index("trip_members_user_idx").on(table.userId),
  ],
);

export const tripInvitations = pgTable(
  "trip_invitations",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    inviteeEmail: text("invitee_email").notNull(),
    inviteeName: text("invitee_name").notNull().default(""),
    inviteeUserId: text("invitee_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    role: text("role").notNull().default("editor"),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"),
    createdAt: msDate("created_at").notNull(),
    expiresAt: msDate("expires_at").notNull(),
    respondedAt: msDate("responded_at"),
  },
  (table) => [
    index("invitations_email_idx").on(table.inviteeEmail),
    index("invitations_trip_idx").on(table.tripId),
  ],
);

// ---------------------------------------------------------------------------
// Itinerary
// ---------------------------------------------------------------------------

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    dayDate: text("day_date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time"),
    title: text("title").notNull(),
    place: text("place").notNull().default(""),
    address: text("address"),
    mapUrl: text("map_url"),
    referenceUrl: text("reference_url"),
    description: text("description"),
    /** "ai" for suggestions saved from the planner; null for hand-added items. */
    source: text("source"),
    costMinor: integer("cost_minor"),
    category: text("category").notNull().default("Activity"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: msDate("created_at").notNull(),
    updatedAt: msDate("updated_at").notNull(),
  },
  (table) => [index("itinerary_trip_day_idx").on(table.tripId, table.dayDate)],
);

// ---------------------------------------------------------------------------
// Expenses and equal splits
// ---------------------------------------------------------------------------

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    category: text("category").notNull().default("Other"),
    spentOn: text("spent_on").notNull(),
    paidBy: text("paid_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: msDate("created_at").notNull(),
    updatedAt: msDate("updated_at").notNull(),
  },
  (table) => [index("expenses_trip_idx").on(table.tripId)],
);

export const expenseSplits = pgTable(
  "expense_splits",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    shareMinor: integer("share_minor").notNull(),
  },
  (table) => [
    uniqueIndex("expense_splits_expense_user_idx").on(
      table.expenseId,
      table.userId,
    ),
    index("expense_splits_user_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export const polls = pgTable(
  "polls",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    description: text("description").notNull().default(""),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    closesAt: msDate("closes_at"),
    status: text("status").notNull().default("open"),
    createdAt: msDate("created_at").notNull(),
  },
  (table) => [index("polls_trip_idx").on(table.tripId)],
);

export const pollOptions = pgTable(
  "poll_options",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("poll_options_poll_idx").on(table.pollId)],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: msDate("created_at").notNull(),
  },
  (table) => [
    // One vote per member per poll, enforced by the database itself.
    uniqueIndex("poll_votes_poll_user_idx").on(table.pollId, table.userId),
    index("poll_votes_option_idx").on(table.optionId),
  ],
);

// ---------------------------------------------------------------------------
// Packing list and notes
// ---------------------------------------------------------------------------

export const packingItems = pgTable(
  "packing_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("Essentials"),
    notes: text("notes"),
    quantity: integer("quantity").notNull().default(1),
    assignedTo: text("assigned_to").references(() => user.id, {
      onDelete: "set null",
    }),
    packed: boolean("packed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: msDate("created_at").notNull(),
  },
  (table) => [index("packing_trip_idx").on(table.tripId)],
);

export const tripNotes = pgTable(
  "trip_notes",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: text("category").notNull().default("General"),
    createdAt: msDate("created_at").notNull(),
    updatedAt: msDate("updated_at").notNull(),
  },
  (table) => [index("notes_trip_idx").on(table.tripId)],
);

// ---------------------------------------------------------------------------
// Feedback and notifications
// ---------------------------------------------------------------------------

export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    message: text("message").notNull().default(""),
    createdAt: msDate("created_at").notNull(),
  },
  (table) => [index("feedback_user_idx").on(table.userId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readAt: msDate("read_at"),
    createdAt: msDate("created_at").notNull(),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// Two-factor authentication (owned by the Better Auth twoFactor plugin)
// ---------------------------------------------------------------------------

/**
 * One row per enrolled authenticator. The TOTP secret and the hashed backup
 * codes never leave the server: Better Auth marks both `returned: false`, and
 * every read path in this app goes through Better Auth rather than raw SQL.
 */
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count")
      .notNull()
      .default(0),
    lockedUntil: msDate("locked_until"),
  },
  (table) => [
    index("two_factor_secret_idx").on(table.secret),
    index("two_factor_user_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Admin audit trail
// ---------------------------------------------------------------------------

/**
 * Append-only record of privileged actions. Only platform admins can trigger
 * the actions that write here, and nothing in the app updates or deletes rows.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    detail: text("detail").notNull().default(""),
    createdAt: msDate("created_at").notNull(),
  },
  (table) => [index("admin_audit_actor_idx").on(table.actorId)],
);

// ---------------------------------------------------------------------------
// Trip activity history
// ---------------------------------------------------------------------------

/**
 * The group's shared history: what changed, who changed it, when.
 *
 * Rows are written by the same server actions that perform the change, so the
 * feed can never claim something that did not happen. The cascade keeps the
 * feed inside the trip's lifetime, and a removed member's rows survive with a
 * null actor because the event itself is still true.
 */
export const tripActivity = pgTable(
  "trip_activity",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Short machine kind, e.g. `trip.created` or `expense.added`. */
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    createdAt: msDate("created_at").notNull(),
  },
  (table) => [
    index("trip_activity_trip_idx").on(table.tripId, table.createdAt),
  ],
);

/** Used by a trigger-free "is there at least one account?" bootstrap check. */
export const schemaReady = pgTable("schema_ready", {
  id: integer("id").primaryKey(),
  appliedAt: msDate("applied_at")
    .notNull()
    .default(sql`(extract(epoch from clock_timestamp()) * 1000)::bigint`),
});
