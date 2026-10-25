"use server";

import { z } from "zod";
import { coverForValue } from "@/lib/covers";
import { customSplitMinor, rupeesToMinor, splitEquallyMinor } from "@/lib/money";
import {
  notificationPreferenceFor,
  parseNotificationPreferences,
  serializeNotificationPreferences,
} from "@/lib/notifications";
import type { ActionResult } from "@/lib/workspace";
import type {
  AppNotification,
  NotificationPreferences,
  PackingCategory,
} from "@/lib/types";
import { getSessionUser, type SessionUser } from "./auth";
import { loadNotificationsBefore, loadWorkspace } from "./data";
import { isEmailConfigured, emailSignOff, sendEmail } from "./email";
import { getBindings, getD1 } from "./db";
import {
  getTripDates,
  requireMembers,
  requireTripRole,
  TemplateTripError,
  TripAccessError,
  tripIdForChild,
} from "./permissions";
import { copyTemplateForUser } from "./template";
import {
  accountDeleteSchema,
  activitySchema,
  copyTemplateSchema,
  expenseSchema,
  feedbackSchema,
  firstIssue,
  invitationSchema,
  memberRemoveSchema,
  memberRoleSchema,
  noteSchema,
  noteUpdateSchema,
  notificationIdSchema,
  notificationPreferencesSchema,
  packingSchema,
  passwordChangeSchema,
  pollSchema,
  profileSchema,
  roleSchema,
  tripSchema,
  voteSchema,
} from "./validation";

/**
 * Every mutation the interface can perform.
 *
 * Each one starts by identifying the signed-in user, then validates its input,
 * then checks the caller's role for the exact trip it touches. Nothing trusts
 * a trip id, a member id or a role that arrived from the browser.
 */

const EDITOR_ROLES = ["owner", "editor"] as const;
const ALL_ROLES = ["owner", "editor", "viewer"] as const;

function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) {
    return { ok: false, error: firstIssue(error) };
  }
  if (error instanceof TripAccessError || error instanceof TemplateTripError) {
    return { ok: false, error: error.message };
  }
  // Log the class and message only: never the payload or a secret.
  console.error(
    "[tripsync] server action failed:",
    error instanceof Error ? `${error.name}: ${error.message}` : "unknown error",
  );
  return {
    ok: false,
    error: "Something went wrong on the server. Nothing was saved — please try again.",
  };
}

async function currentUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new TripAccessError("Your session has expired. Sign in again to continue.");
  }
  return user;
}

async function done(
  userId: string,
  notice?: string,
  createdTripId?: string,
): Promise<ActionResult> {
  return { ok: true, state: await loadWorkspace(userId), notice, createdTripId };
}

/**
 * Appends a privileged action to the audit trail.
 *
 * An audit write failure is logged but never rolls back the action the admin
 * asked for: pretending the role change failed after it succeeded would be
 * worse than a missing log line, and the row is written before the response.
 */
async function audit(
  actorId: string,
  action: "role.change" | "account.delete",
  targetId: string,
  detail = "",
) {
  try {
    await getD1()
      .prepare(
        `insert into admin_audit_log (id, actor_id, action, target_id, detail, created_at)
         values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), actorId, action, targetId, detail, Date.now())
      .run();
  } catch (error) {
    console.error(
      "[tripsync] audit write failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

/**
 * Appends one line to a trip's shared history.
 *
 * Written by the same action that performed the change, so the feed never
 * claims something that did not happen. A failed write is logged and never
 * rolls back the change itself: the user's edit is more important than a
 * missing history line.
 */
async function logActivity(
  tripId: string,
  actorId: string | null,
  kind: string,
  summary: string,
) {
  try {
    await getD1()
      .prepare(
        `insert into trip_activity (id, trip_id, actor_id, kind, summary, created_at)
         values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tripId, actorId, kind, summary, Date.now())
      .run();
  } catch (error) {
    console.error(
      "[tripsync] activity write failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

async function notifyUsers(
  userIds: string[],
  notification: {
    type: "invitation" | "membership" | "poll" | "budget" | "itinerary";
    title: string;
    body?: string;
    href?: string;
  },
) {
  const candidates = [...new Set(userIds)].filter(Boolean);
  if (candidates.length === 0) return;
  const db = getD1();
  const now = Date.now();

  // Respect each recipient's own switches before anything is written.
  const placeholders = candidates.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `select id, notification_prefs from "user" where id in (${placeholders})`,
    )
    .bind(...candidates)
    .all<{ id: string; notification_prefs: string }>();
  const preference = notificationPreferenceFor[notification.type];
  const recipients = (results ?? [])
    .filter((row) => parseNotificationPreferences(row.notification_prefs)[preference])
    .map((row) => row.id);
  if (recipients.length === 0) return;

  // A retried or double-submitted event must not stack identical rows. The
  // same title, type and destination inside ten minutes is the same event.
  const recent = await db
    .prepare(
      `select user_id from notifications
       where user_id in (${recipients.map(() => "?").join(", ")})
         and type = ? and title = ? and coalesce(href, '') = ?
         and created_at > ?`,
    )
    .bind(...recipients, notification.type, notification.title, notification.href ?? "", now - 10 * 60 * 1000)
    .all<{ user_id: string }>();
  const alreadyNotified = new Set((recent.results ?? []).map((row) => row.user_id));
  const fresh = recipients.filter((userId) => !alreadyNotified.has(userId));
  if (fresh.length === 0) return;

  await db.batch(
    fresh.map((userId) =>
      db
        .prepare(
          `insert into notifications (id, user_id, type, title, body, href, read_at, created_at)
           values (?, ?, ?, ?, ?, ?, null, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          userId,
          notification.type,
          notification.title,
          notification.body ?? "",
          notification.href ?? null,
          now,
        ),
    ),
  );
}

async function tripMemberIds(tripId: string) {
  const { results } = await getD1()
    .prepare(`select user_id from trip_members where trip_id = ?`)
    .bind(tripId)
    .all<{ user_id: string }>();
  return (results ?? []).map((row) => row.user_id);
}

/**
 * Sends one transactional email about a membership or invitation event.
 *
 * This is deliberately best effort and preference-gated: the matching in-app
 * notification has already been written, so a missing provider, a provider
 * error or a switched-off preference must never undo the user's action — and
 * must never claim a message was delivered when it was not.
 */
async function emailEvent(
  userId: string,
  preference: keyof NotificationPreferences,
  subject: string,
  lines: string[],
  path?: string,
) {
  if (!isEmailConfigured()) return;
  const target = await getD1()
    .prepare(`select email, notification_prefs from "user" where id = ?`)
    .bind(userId)
    .first<{ email: string; notification_prefs: string }>();
  if (!target) return;
  if (!parseNotificationPreferences(target.notification_prefs)[preference]) return;
  const base = (getBindings().BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
  try {
    await sendEmail({
      to: target.email,
      subject,
      text: [
        ...lines,
        ...(path ? ["", `Open it: ${base}${path}`] : []),
        emailSignOff,
      ].join("\n"),
    });
  } catch {
    // Delivery is best effort; the in-app notification already exists.
  }
}

/** Members of a trip other than the person performing the action. */
async function tripMates(tripId: string, actorId: string) {
  const members = await tripMemberIds(tripId);
  return members.filter((id) => id !== actorId);
}

/**
 * Builds the stored splits for an expense.
 *
 * Without `shares` the cost is split equally. With `shares`, every selected
 * participant must have one, and their total must match the expense (rounding
 * within a paisa per person is absorbed, a real mismatch is refused so the
 * balances can never disagree with what was spent).
 */
function expenseShares(
  values: { participantIds: string[]; shares?: Record<string, number> },
  amountMinor: number,
) {
  if (!values.shares || Object.keys(values.shares).length === 0) {
    return splitEquallyMinor(amountMinor, values.participantIds);
  }
  const shares = values.shares;
  const missing = values.participantIds.filter((id) => !(id in shares));
  if (missing.length > 0) {
    throw new TripAccessError(
      "Give every selected person a share, or switch back to an equal split.",
    );
  }
  const entered = values.participantIds.reduce(
    (total, id) => total + Math.round(shares[id] * 100),
    0,
  );
  if (Math.abs(entered - amountMinor) > values.participantIds.length) {
    throw new TripAccessError(
      `The shares add up to ₹${(entered / 100).toFixed(2)} but the expense is ₹${(amountMinor / 100).toFixed(2)}. Adjust them so they match.`,
    );
  }
  return customSplitMinor(amountMinor, shares);
}

async function tripSummary(tripId: string) {
  return getD1()
    .prepare(
      `select name, owner_id, budget_minor, destination, start_date, end_date
       from trips where id = ?`,
    )
    .bind(tripId)
    .first<{
      name: string;
      owner_id: string;
      budget_minor: number | null;
      destination: string;
      start_date: string;
      end_date: string;
    }>();
}

/* ------------------------------------------------------------------ trips */

export async function createTripAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = tripSchema.parse(input);
    const cover = coverForValue(values.coverImage, values.destination);
    const id = crypto.randomUUID();
    const now = Date.now();
    const db = getD1();
    await db.batch([
      db
        .prepare(
          `insert into trips (id, owner_id, name, destination, region, description, start_date, end_date, traveller_count, budget_minor, currency, cover_image, cover_alt, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?)`,
        )
        .bind(
          id,
          user.id,
          values.name,
          values.destination,
          values.destination,
          values.description ||
            "A new trip for the group. Add the first activities when the plan starts to take shape.",
          values.startDate,
          values.endDate,
          Number(values.travellers),
          values.budget === "" ? null : rupeesToMinor(Number(values.budget)),
          cover.value,
          cover.alt,
          now,
          now,
        ),
      db
        .prepare(
          `insert into trip_members (id, trip_id, user_id, role, joined_at)
           values (?, ?, ?, 'owner', ?)`,
        )
        .bind(crypto.randomUUID(), id, user.id, now),
    ]);
    await logActivity(
      id,
      user.id,
      "trip.created",
      `Created the trip to ${values.destination}`,
    );
    return await done(user.id, undefined, id);
  } catch (error) {
    return failure(error);
  }
}

export async function updateTripAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, ["owner"]);
    const values = tripSchema.parse(input);
    const cover = coverForValue(values.coverImage, values.destination);

    // Shortening a trip never moves or deletes saved activities: the change is
    // refused and the owner is told exactly what needs resolving first.
    const stranded = await getD1()
      .prepare(
        `select count(*) as total from itinerary_items
         where trip_id = ? and (day_date < ? or day_date > ?)`,
      )
      .bind(tripId, values.startDate, values.endDate)
      .first<{ total: number }>();
    if ((stranded?.total ?? 0) > 0) {
      throw new TripAccessError(
        `${stranded?.total} ${stranded?.total === 1 ? "activity falls" : "activities fall"} outside ${values.startDate} to ${values.endDate}. Move or remove ${stranded?.total === 1 ? "it" : "them"} in the itinerary first — nothing was changed.`,
      );
    }

    await getD1()
      .prepare(
        `update trips set name = ?, destination = ?, region = ?, description = ?,
           start_date = ?, end_date = ?, traveller_count = ?, budget_minor = ?, cover_image = ?, cover_alt = ?, updated_at = ?
         where id = ?`,
      )
      .bind(
        values.name,
        values.destination,
        values.destination,
        values.description,
        values.startDate,
        values.endDate,
        Number(values.travellers),
        values.budget === "" ? null : rupeesToMinor(Number(values.budget)),
        cover.value,
        cover.alt,
        Date.now(),
        tripId,
      )
      .run();
    await logActivity(tripId, user.id, "trip.updated", "Updated the trip details");
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTripAction(tripId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, ["owner"]);
    // Foreign keys cascade to members, itinerary, expenses, polls, packing and
    // notes, so a deleted trip never leaves orphaned records behind.
    await getD1().prepare(`delete from trips where id = ?`).bind(tripId).run();
    return await done(user.id, "Trip deleted, together with its itinerary, expenses, polls, lists and notes.");
  } catch (error) {
    return failure(error);
  }
}

export async function leaveTripAction(tripId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const role = await requireTripRole(user.id, tripId, ALL_ROLES);
    if (role === "owner") {
      throw new TripAccessError(
        "Owners cannot leave their own trip. Delete it instead.",
      );
    }
    const trip = await tripSummary(tripId);
    await getD1()
      .prepare(`delete from trip_members where trip_id = ? and user_id = ?`)
      .bind(tripId, user.id)
      .run();
    if (trip) {
      await notifyUsers([trip.owner_id], {
        type: "membership",
        title: `${user.name} left ${trip.name}`,
        body: "Their access has been removed. You can invite them again later.",
        href: `/preview/trips/${tripId}`,
      });
    }
    await logActivity(tripId, user.id, "member.left", "Left the trip");
    return await done(user.id, "You left the trip.");
  } catch (error) {
    return failure(error);
  }
}

export async function copyTemplateAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = copyTemplateSchema.parse(input ?? {});
    const tripId = await copyTemplateForUser(user.id, { name: values.name });
    return await done(
      user.id,
      "Your copy is ready and fully editable. The example trip is unchanged.",
      tripId,
    );
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------------------------------------- itinerary */

/**
 * The next persisted position for a day, so a new activity is appended to that
 * day instead of colliding with the order of the activities already there.
 */
async function nextSortOrder(tripId: string, date: string): Promise<number> {
  const row = await getD1()
    .prepare(
      `select coalesce(max(sort_order), -1) as max_order from itinerary_items
       where trip_id = ? and day_date = ?`,
    )
    .bind(tripId, date)
    .first<{ max_order: number }>();
  return (row?.max_order ?? -1) + 1;
}

async function assertDateWithinTrip(tripId: string, date: string) {
  const { startDate, endDate } = await getTripDates(tripId);
  if (date < startDate || date > endDate) {
    throw new TripAccessError(
      `Activities must fall between ${startDate} and ${endDate}.`,
    );
  }
}

export async function addItineraryItemAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = activitySchema.parse(input);
    await assertDateWithinTrip(tripId, values.date);
    const now = Date.now();
    const sortOrder = await nextSortOrder(tripId, values.date);
    await getD1()
      .prepare(
        `insert into itinerary_items (id, trip_id, day_date, start_time, end_time, title, place, address, map_url, reference_url, description, cost_minor, category, sort_order, created_by, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        tripId,
        values.date,
        values.startTime,
        values.endTime || null,
        values.title,
        values.location,
        values.address || null,
        values.mapUrl || null,
        values.referenceUrl || null,
        values.description || null,
        values.estimatedCost === "" ? null : rupeesToMinor(Number(values.estimatedCost)),
        values.category,
        sortOrder,
        user.id,
        now,
        now,
      )
      .run();

    const mates = await tripMates(tripId, user.id);
    if (mates.length > 0) {
      const trip = await tripSummary(tripId);
      await notifyUsers(mates, {
        type: "itinerary",
        title: `${user.name} added an activity to ${trip?.name ?? "a trip"}`,
        body: `${values.title} — ${values.location}`,
        href: `/preview/trips/${tripId}/itinerary`,
      });
    }
    await logActivity(
      tripId,
      user.id,
      "itinerary.added",
      `Added “${values.title}” to the itinerary`,
    );
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

export async function updateItineraryItemAction(
  itemId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("itinerary_items", itemId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = activitySchema.parse(input);
    await assertDateWithinTrip(tripId, values.date);
    // Refuse a silent overwrite: if another member saved this activity after
    // the editor opened it, the write fails and they see the other version.
    const current = await getD1()
      .prepare(`select updated_at from itinerary_items where id = ? and trip_id = ?`)
      .bind(itemId, tripId)
      .first<{ updated_at: number }>();
    const expected = (input as { expectedUpdatedAt?: number }).expectedUpdatedAt;
    if (current && typeof expected === "number" && current.updated_at !== expected) {
      throw new TripAccessError(
        "Someone else changed this activity while you were editing. Reload the itinerary to see their version before saving yours.",
      );
    }
    await getD1()
      .prepare(
        `update itinerary_items set day_date = ?, start_time = ?, end_time = ?, title = ?,
           place = ?, address = ?, map_url = ?, reference_url = ?, description = ?, cost_minor = ?, category = ?, updated_at = ?
         where id = ? and trip_id = ?`,
      )
      .bind(
        values.date,
        values.startTime,
        values.endTime || null,
        values.title,
        values.location,
        values.address || null,
        values.mapUrl || null,
        values.referenceUrl || null,
        values.description || null,
        values.estimatedCost === "" ? null : rupeesToMinor(Number(values.estimatedCost)),
        values.category,
        Date.now(),
        itemId,
        tripId,
      )
      .run();

    const mates = await tripMates(tripId, user.id);
    if (mates.length > 0) {
      const trip = await tripSummary(tripId);
      await notifyUsers(mates, {
        type: "itinerary",
        title: `${user.name} changed an activity on ${trip?.name ?? "a trip"}`,
        body: values.title,
        href: `/preview/trips/${tripId}/itinerary`,
      });
    }
    await logActivity(
      tripId,
      user.id,
      "itinerary.updated",
      `Updated “${values.title}”`,
    );
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Moves an activity up or down within its day.
 *
 * The activity's start and end time are swapped with its neighbour's, so the
 * chronological order the interface shows is also the order stored in the
 * database — after a refresh, or for another member, the plan reads the same.
 * The whole swap runs as one D1 batch, so a failure leaves both rows untouched.
 */
export async function moveItineraryItemAction(
  itemId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("itinerary_items", itemId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    if (direction !== "up" && direction !== "down") {
      throw new TripAccessError("Choose a direction to move the activity.");
    }

    const db = getD1();
    const current = await db
      .prepare(
        `select id, day_date from itinerary_items where id = ? and trip_id = ?`,
      )
      .bind(itemId, tripId)
      .first<{ id: string; day_date: string }>();
    if (!current) throw new TripAccessError("That activity no longer exists.");

    // Read the day in its stored order, swap the activity with its neighbour,
    // then write the positions back as 0..n-1. Times are never touched, and the
    // renumbering is normalised so rows saved before ordering existed sort
    // correctly after the first move.
    const siblings = await db
      .prepare(
        `select id from itinerary_items
         where trip_id = ? and day_date = ?
         order by sort_order, start_time, created_at`,
      )
      .bind(tripId, current.day_date)
      .all<{ id: string }>();
    const rows = siblings.results ?? [];
    const index = rows.findIndex((row) => row.id === itemId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= rows.length) {
      throw new TripAccessError(
        direction === "up"
          ? "That activity is already first in the day."
          : "That activity is already last in the day.",
      );
    }

    const ordered = [...rows];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await db.batch(
      ordered.map((row, position) =>
        db
          .prepare(
            `update itinerary_items set sort_order = ? where id = ? and trip_id = ?`,
          )
          .bind(position, row.id, tripId),
      ),
    );

    await logActivity(tripId, user.id, "itinerary.moved", "Reordered activities for a day");
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteItineraryItemAction(itemId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("itinerary_items", itemId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const existing = await getD1()
      .prepare(`select title from itinerary_items where id = ? and trip_id = ?`)
      .bind(itemId, tripId)
      .first<{ title: string }>();
    await getD1()
      .prepare(`delete from itinerary_items where id = ? and trip_id = ?`)
      .bind(itemId, tripId)
      .run();

    const mates = await tripMates(tripId, user.id);
    if (mates.length > 0) {
      const trip = await tripSummary(tripId);
      await notifyUsers(mates, {
        type: "itinerary",
        title: `${user.name} removed an activity from ${trip?.name ?? "a trip"}`,
        body: existing?.title ?? "",
        href: `/preview/trips/${tripId}/itinerary`,
      });
    }
    if (existing) {
      await logActivity(
        tripId,
        user.id,
        "itinerary.deleted",
        `Removed “${existing.title}” from the itinerary`,
      );
    }
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

const draftItemsSchema = z
  .array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().max(600).optional(),
      location: z.string().trim().max(140),
      estimatedCost: z.number().min(0).max(10_000_000).optional(),
      category: z.enum([
        "Food",
        "Stay",
        "Transport",
        "Activity",
        "Sightseeing",
        "Shopping",
        "Free time",
      ]),
    }),
  )
  .min(1)
  .max(30);

/**
 * The same venue at the same time on the same day is one activity.
 * Returns the first repeated entry so the message can name it.
 */
function findDuplicateItem(items: z.infer<typeof draftItemsSchema>) {
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.date}|${item.startTime}|${item.title.trim().toLowerCase()}`;
    if (seen.has(key)) return item;
    seen.add(key);
  }
  return null;
}

export async function addDraftItemsAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const items = draftItemsSchema.parse(input);
    const duplicate = findDuplicateItem(items);
    if (duplicate) {
      throw new TripAccessError(
        `"${duplicate.title}" is listed twice on ${duplicate.date} at ${duplicate.startTime}. Remove one before saving.`,
      );
    }
    const { startDate, endDate } = await getTripDates(tripId);
    for (const item of items) {
      if (item.date < startDate || item.date > endDate) {
        throw new TripAccessError("A suggested day falls outside the trip dates.");
      }
    }
    const db = getD1();
    const now = Date.now();
    const positions = new Map<string, number>();
    for (const date of new Set(items.map((item) => item.date))) {
      positions.set(date, await nextSortOrder(tripId, date));
    }
    await db.batch(
      items.map((item) => {
        const sortOrder = positions.get(item.date) ?? 0;
        positions.set(item.date, sortOrder + 1);
        return db
          .prepare(
            `insert into itinerary_items (id, trip_id, day_date, start_time, end_time, title, place, description, source, cost_minor, category, sort_order, created_by, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            tripId,
            item.date,
            item.startTime,
            item.endTime ?? null,
            item.title,
            item.location,
            item.description ?? null,
            item.estimatedCost === undefined ? null : rupeesToMinor(item.estimatedCost),
            item.category,
            sortOrder,
            user.id,
            now,
            now,
          );
      }),
    );
    return await done(
      user.id,
      `${items.length} approved ${items.length === 1 ? "activity" : "activities"} added. Existing plans were left untouched.`,
    );
  } catch (error) {
    return failure(error);
  }
}

/**
 * Replaces the approved activities on a specific set of days, atomically.
 *
 * The caller explicitly confirmed the overwrite in the interface. D1 runs the
 * whole batch as one transaction, so the old activities are never deleted
 * unless the new ones are written in the same breath — a failed save leaves
 * the existing itinerary exactly as it was.
 */
export async function replaceDraftDaysAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const parsed = z.object({
      dates: z
        .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
        .min(1)
        .max(31),
      items: draftItemsSchema,
    }).parse(input);

    const duplicate = findDuplicateItem(parsed.items);
    if (duplicate) {
      throw new TripAccessError(
        `"${duplicate.title}" is listed twice on ${duplicate.date} at ${duplicate.startTime}. Remove one before saving.`,
      );
    }

    const dates = [...new Set(parsed.dates)].sort();
    for (const item of parsed.items) {
      if (!dates.includes(item.date)) {
        throw new TripAccessError(
          "An approved activity is assigned to a day that is not being replaced.",
        );
      }
    }

    const { startDate, endDate } = await getTripDates(tripId);
    for (const date of dates) {
      if (date < startDate || date > endDate) {
        throw new TripAccessError("A day to replace falls outside the trip dates.");
      }
    }
    for (const item of parsed.items) {
      if (item.date < startDate || item.date > endDate) {
        throw new TripAccessError("A suggested day falls outside the trip dates.");
      }
    }

    const db = getD1();
    const now = Date.now();
    const placeholders = dates.map(() => "?").join(", ");
    const positions = new Map<string, number>();
    await db.batch([
      db
        .prepare(
          `delete from itinerary_items where trip_id = ? and day_date in (${placeholders})`,
        )
        .bind(tripId, ...dates),
      ...parsed.items.map((item) => {
        const sortOrder = positions.get(item.date) ?? 0;
        positions.set(item.date, sortOrder + 1);
        return db
          .prepare(
            `insert into itinerary_items (id, trip_id, day_date, start_time, end_time, title, place, description, source, cost_minor, category, sort_order, created_by, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            tripId,
            item.date,
            item.startTime,
            item.endTime ?? null,
            item.title,
            item.location,
            item.description ?? null,
            item.estimatedCost === undefined ? null : rupeesToMinor(item.estimatedCost),
            item.category,
            sortOrder,
            user.id,
            now,
            now,
          );
      }),
    ]);
    return await done(
      user.id,
      `${dates.length === 1 ? "That day" : `${dates.length} days`} replaced with ${parsed.items.length} approved ${parsed.items.length === 1 ? "activity" : "activities"}.`,
    );
  } catch (error) {
    return failure(error);
  }
}

/* --------------------------------------------------------------- expenses */

export async function addExpenseAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = expenseSchema.parse(input);
    await requireMembers(tripId, [...values.participantIds, values.payerId]);
    const { startDate, endDate } = await getTripDates(tripId);
    if (values.date < startDate || values.date > endDate) {
      throw new TripAccessError(
        `Record expenses between ${startDate} and ${endDate}, the dates of this trip.`,
      );
    }
    const amountMinor = rupeesToMinor(Number(values.amount));
    const shares = expenseShares(values, amountMinor);
    const expenseId = crypto.randomUUID();
    const now = Date.now();
    const db = getD1();
    await db.batch([
      db
        .prepare(
          `insert into expenses (id, trip_id, description, amount_minor, currency, category, spent_on, paid_by, notes, created_by, created_at, updated_at)
           values (?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          expenseId,
          tripId,
          values.description,
          amountMinor,
          values.category,
          values.date,
          values.payerId,
          values.notes?.trim() || null,
          user.id,
          now,
          now,
        ),
      ...shares.map((share) =>
        db
          .prepare(
            `insert into expense_splits (id, expense_id, user_id, share_minor) values (?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), expenseId, share.userId, share.shareMinor),
      ),
    ]);

    const trip = await tripSummary(tripId);
    if (trip?.budget_minor) {
      const total = await getD1()
        .prepare(`select coalesce(sum(amount_minor), 0) as total from expenses where trip_id = ?`)
        .bind(tripId)
        .first<{ total: number }>();
      if ((total?.total ?? 0) > trip.budget_minor) {
        await notifyUsers([trip.owner_id], {
          type: "budget",
          title: `${trip.name} is over budget`,
          body: "A new expense pushed the trip past its planned budget.",
          href: `/preview/trips/${tripId}/expenses`,
        });
      }
    }
    await logActivity(
      tripId,
      user.id,
      "expense.added",
      `Recorded “${values.description}”`,
    );
    // Everyone sharing the cost hears about it once — not the person who
    // recorded it, and not members who are not part of this expense.
    const involved = shares
      .map((share) => share.userId)
      .filter((id) => id !== user.id);
    if (involved.length > 0) {
      await notifyUsers(involved, {
        type: "budget",
        title: `${user.name} added an expense to ${trip?.name ?? "a trip"}`,
        body: `${values.description} — ₹${(amountMinor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
        href: `/preview/trips/${tripId}/expenses`,
      });
    }
    return await done(user.id, "Expense recorded. Totals and balances have been updated.");
  } catch (error) {
    return failure(error);
  }
}

export async function updateExpenseAction(
  expenseId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("expenses", expenseId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = expenseSchema.parse(input);
    await requireMembers(tripId, [...values.participantIds, values.payerId]);
    const { startDate, endDate } = await getTripDates(tripId);
    if (values.date < startDate || values.date > endDate) {
      throw new TripAccessError(
        `Record expenses between ${startDate} and ${endDate}, the dates of this trip.`,
      );
    }
    const amountMinor = rupeesToMinor(Number(values.amount));
    const shares = expenseShares(values, amountMinor);
    const db = getD1();
    await db.batch([
      db
        .prepare(
          `update expenses set description = ?, amount_minor = ?, category = ?, spent_on = ?,
             paid_by = ?, notes = ?, updated_at = ?
           where id = ? and trip_id = ?`,
        )
        .bind(
          values.description,
          amountMinor,
          values.category,
          values.date,
          values.payerId,
          values.notes?.trim() || null,
          Date.now(),
          expenseId,
          tripId,
        ),
      db.prepare(`delete from expense_splits where expense_id = ?`).bind(expenseId),
      ...shares.map((share) =>
        db
          .prepare(
            `insert into expense_splits (id, expense_id, user_id, share_minor) values (?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), expenseId, share.userId, share.shareMinor),
      ),
    ]);
    await logActivity(
      tripId,
      user.id,
      "expense.updated",
      `Updated the expense “${values.description}”`,
    );
    return await done(user.id, "Expense updated. Totals and balances have been recalculated.");
  } catch (error) {
    return failure(error);
  }
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("expenses", expenseId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const existing = await getD1()
      .prepare(`select description from expenses where id = ? and trip_id = ?`)
      .bind(expenseId, tripId)
      .first<{ description: string }>();
    await getD1()
      .prepare(`delete from expenses where id = ? and trip_id = ?`)
      .bind(expenseId, tripId)
      .run();
    if (existing) {
      await logActivity(
        tripId,
        user.id,
        "expense.deleted",
        `Deleted the expense “${existing.description}”`,
      );
    }
    return await done(user.id, "Expense deleted. Totals and balances have been recalculated.");
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ polls */

export async function createPollAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = pollSchema.parse(input);
    const uniqueOptions = values.options.map((option) => option.trim());
    if (new Set(uniqueOptions.map((option) => option.toLowerCase())).size !== uniqueOptions.length) {
      throw new TripAccessError("Poll options must be different from each other.");
    }
    const closesAt = values.closesAt
      ? Date.parse(`${values.closesAt}T23:59:59Z`)
      : null;
    if (closesAt !== null && closesAt <= Date.now()) {
      throw new TripAccessError("The closing date must be in the future.");
    }
    const pollId = crypto.randomUUID();
    const now = Date.now();
    const db = getD1();
    await db.batch([
      db
        .prepare(
          `insert into polls (id, trip_id, question, description, created_by, closes_at, status, created_at)
           values (?, ?, ?, ?, ?, ?, 'open', ?)`,
        )
        .bind(
          pollId,
          tripId,
          values.question,
          values.description?.trim() ?? "",
          user.id,
          closesAt,
          now,
        ),
      ...uniqueOptions.map((label, index) =>
        db
          .prepare(`insert into poll_options (id, poll_id, label, sort_order) values (?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), pollId, label, index),
      ),
    ]);

    const members = await tripMemberIds(tripId);
    const trip = await tripSummary(tripId);
    await notifyUsers(
      members.filter((id) => id !== user.id),
      {
        type: "poll",
        title: `New poll in ${trip?.name ?? "a trip"}`,
        body: values.question,
        href: `/preview/trips/${tripId}/polls`,
      },
    );
    await logActivity(
      tripId,
      user.id,
      "poll.created",
      `Opened the poll “${values.question}”`,
    );
    return await done(user.id, "Poll opened. Trip members can vote once each.");
  } catch (error) {
    return failure(error);
  }
}

export async function votePollAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const { pollId, optionId } = voteSchema.parse(input);
    const poll = await getD1()
      .prepare(
        `select p.trip_id, p.status, p.closes_at, o.id as option_id
         from polls p left join poll_options o on o.poll_id = p.id and o.id = ?
         where p.id = ?`,
      )
      .bind(optionId, pollId)
      .first<{ trip_id: string; status: string; closes_at: number | null; option_id: string | null }>();
    if (!poll) throw new TripAccessError("That poll no longer exists.");
    if (!poll.option_id) throw new TripAccessError("That option no longer exists.");
    await requireTripRole(user.id, poll.trip_id, [...ALL_ROLES]);
    if (poll.status !== "open" || (poll.closes_at !== null && poll.closes_at < Date.now())) {
      throw new TripAccessError("This poll is closed.");
    }
    // The unique index on (poll_id, user_id) is what makes "one vote per
    // member" true even if two requests arrive at the same time. The insert is
    // conditional on the poll still being open, so a closure that commits
    // between the check above and this write cannot be overridden.
    const now = Date.now();
    const written = await getD1()
      .prepare(
        `insert into poll_votes (id, poll_id, option_id, user_id, created_at)
         select ?, ?, ?, ?, ?
         where exists (
           select 1 from polls
           where id = ? and status = 'open' and (closes_at is null or closes_at >= ?)
         )
         on conflict(poll_id, user_id) do update set
           option_id = excluded.option_id, created_at = excluded.created_at`,
      )
      .bind(crypto.randomUUID(), pollId, optionId, user.id, now, pollId, now)
      .run();
    if ((written.meta.changes ?? 0) === 0) {
      throw new TripAccessError("This poll closed before the vote was saved.");
    }
    return await done(user.id, "Vote recorded.");
  } catch (error) {
    return failure(error);
  }
}

export async function closePollAction(pollId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("polls", pollId);
    const role = await requireTripRole(user.id, tripId, [...ALL_ROLES]);
    const poll = await getD1()
      .prepare(`select created_by, status, question from polls where id = ?`)
      .bind(pollId)
      .first<{ created_by: string; status: string; question: string }>();
    if (!poll) throw new TripAccessError("That poll no longer exists.");
    if (role !== "owner" && poll.created_by !== user.id) {
      throw new TripAccessError("Only the poll creator or the trip owner can close this poll.");
    }
    if (poll.status !== "open") {
      throw new TripAccessError("This poll is already closed.");
    }
    await getD1()
      .prepare(
        `update polls set status = 'closed' where id = ? and trip_id = ? and status = 'open'`,
      )
      .bind(pollId, tripId)
      .run();
    await logActivity(
      tripId,
      user.id,
      "poll.closed",
      `Closed the poll “${poll.question}”`,
    );
    return await done(user.id, "Poll closed. Results are final and no further votes are accepted.");
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------------------------------- packing, notes */

export async function addPackingItemAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = packingSchema.parse(input);
    if (values.assignedTo) await requireMembers(tripId, [values.assignedTo]);
    await getD1()
      .prepare(
        `insert into packing_items (id, trip_id, name, category, notes, quantity, assigned_to, packed, sort_order, created_by, created_at)
         values (?, ?, ?, ?, ?, ?, ?, false, 0, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        tripId,
        values.name,
        values.category as PackingCategory,
        values.notes?.trim() || null,
        Number(values.quantity),
        values.assignedTo || null,
        user.id,
        Date.now(),
      )
      .run();
    await logActivity(
      tripId,
      user.id,
      "packing.added",
      `Added “${values.name}” to the packing list`,
    );
    return await done(user.id, "Packing item added.");
  } catch (error) {
    return failure(error);
  }
}

export async function updatePackingItemAction(
  itemId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("packing_items", itemId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = packingSchema.parse(input);
    if (values.assignedTo) await requireMembers(tripId, [values.assignedTo]);
    await getD1()
      .prepare(
        `update packing_items set name = ?, category = ?, notes = ?, quantity = ?, assigned_to = ?
         where id = ? and trip_id = ?`,
      )
      .bind(
        values.name,
        values.category,
        values.notes?.trim() || null,
        Number(values.quantity),
        values.assignedTo || null,
        itemId,
        tripId,
      )
      .run();
    return await done(user.id, "Packing item updated.");
  } catch (error) {
    return failure(error);
  }
}

export async function togglePackingItemAction(itemId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("packing_items", itemId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    await getD1()
      .prepare(`update packing_items set packed = not packed where id = ? and trip_id = ?`)
      .bind(itemId, tripId)
      .run();
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

export async function deletePackingItemAction(itemId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("packing_items", itemId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    await getD1()
      .prepare(`delete from packing_items where id = ? and trip_id = ?`)
      .bind(itemId, tripId)
      .run();
    return await done(user.id, "Packing item removed.");
  } catch (error) {
    return failure(error);
  }
}

export async function addNoteAction(
  tripId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = noteSchema.parse(input);
    const now = Date.now();
    await getD1()
      .prepare(
        `insert into trip_notes (id, trip_id, author_id, title, body, category, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        tripId,
        user.id,
        values.title,
        values.body,
        values.category ?? "General",
        now,
        now,
      )
      .run();
    await logActivity(tripId, user.id, "note.added", `Added the note “${values.title}”`);
    return await done(user.id, "Note added for the whole trip.");
  } catch (error) {
    return failure(error);
  }
}

export async function updateNoteAction(
  noteId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("trip_notes", noteId);
    await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const values = noteUpdateSchema.parse(input);
    const expected = Date.parse(values.expectedUpdatedAt);
    const current = await getD1()
      .prepare(`select updated_at from trip_notes where id = ? and trip_id = ?`)
      .bind(noteId, tripId)
      .first<{ updated_at: number }>();
    if (!current) throw new TripAccessError("That note no longer exists.");
    if (current.updated_at !== expected) {
      throw new TripAccessError(
        "Someone else saved this note after you opened it. Your text is still in the form — copy anything you need, then reopen the note to see the latest version.",
      );
    }
    // The timestamp guard makes a concurrent save a clear conflict instead of a
    // silent overwrite: the update only applies if the note is still the version
    // the form was opened with.
    const result = await getD1()
      .prepare(
        `update trip_notes set title = ?, body = ?, category = ?, updated_at = ?
         where id = ? and trip_id = ? and updated_at = ?`,
      )
      .bind(
        values.title,
        values.body,
        values.category ?? "General",
        Date.now(),
        noteId,
        tripId,
        expected,
      )
      .run();
    if (result.meta.changes === 0) {
      throw new TripAccessError(
        "Someone else saved this note while you were editing. Reopen it and try again.",
      );
    }
    await logActivity(tripId, user.id, "note.updated", `Updated the note “${values.title}”`);
    return await done(user.id, "Note updated.");
  } catch (error) {
    return failure(error);
  }
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const tripId = await tripIdForChild("trip_notes", noteId);
    const role = await requireTripRole(user.id, tripId, [...EDITOR_ROLES]);
    const note = await getD1()
      .prepare(`select author_id from trip_notes where id = ? and trip_id = ?`)
      .bind(noteId, tripId)
      .first<{ author_id: string }>();
    if (!note) throw new TripAccessError("That note no longer exists.");
    // Editing is shared, but removing someone else's writing is reserved for
    // the person who wrote it and the trip owner.
    if (note.author_id !== user.id && role !== "owner") {
      throw new TripAccessError(
        "Only the author or the trip owner can delete this note.",
      );
    }
    await getD1()
      .prepare(`delete from trip_notes where id = ? and trip_id = ?`)
      .bind(noteId, tripId)
      .run();
    await logActivity(tripId, user.id, "note.deleted", "Deleted a shared note");
    return await done(user.id, "Note deleted.");
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------- profile and users */

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = profileSchema.parse(input);
    await getD1()
      .prepare(
        `update "user" set name = ?, home_city = ?, travel_style = ?, dietary_notes = ?, updated_at = ?
         where id = ?`,
      )
      .bind(
        values.name,
        values.homeCity,
        values.travelStyle,
        values.dietaryNotes,
        Date.now(),
        user.id,
      )
      .run();
    return await done(user.id, "Profile updated.");
  } catch (error) {
    return failure(error);
  }
}

export async function updateNotificationPreferencesAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = notificationPreferencesSchema.parse(input);
    await getD1()
      .prepare(
        `update "user" set notification_prefs = ?, updated_at = ? where id = ?`,
      )
      .bind(serializeNotificationPreferences(values), Date.now(), user.id)
      .run();
    return await done(user.id, "Notification preferences saved.");
  } catch (error) {
    return failure(error);
  }
}

/** Marks the first-run tour as seen. Skipping and finishing are equivalent. */
export async function completeOnboardingAction(): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await getD1()
      .prepare(
        `update "user" set onboarding_completed_at = coalesce(onboarding_completed_at, ?) where id = ?`,
      )
      .bind(Date.now(), user.id)
      .run();
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

/** Lets someone replay the tour from their profile. */
export async function restartOnboardingAction(): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await getD1()
      .prepare(`update "user" set onboarding_completed_at = null where id = ?`)
      .bind(user.id)
      .run();
    return await done(user.id, "The tour will appear on your dashboard.");
  } catch (error) {
    return failure(error);
  }
}

export async function setUserRoleAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    if (user.role !== "admin") {
      throw new TripAccessError("Only platform admins can change roles.");
    }
    const values = roleSchema.parse(input);
    if (values.userId === user.id && values.role !== "admin") {
      throw new TripAccessError("You cannot remove your own admin access.");
    }
    const target = await getD1()
      .prepare(`select id from "user" where id = ?`)
      .bind(values.userId)
      .first<{ id: string }>();
    if (!target) throw new TripAccessError("That account no longer exists.");
    await getD1()
      .prepare(`update "user" set role = ?, updated_at = ? where id = ?`)
      .bind(values.role, Date.now(), values.userId)
      .run();
    await audit(user.id, "role.change", values.userId, `role=${values.role}`);
    return await done(user.id, `Role updated to ${values.role}.`);
  } catch (error) {
    return failure(error);
  }
}

/* ----------------------------------------------------------- invitations */

export async function sendInvitationAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = invitationSchema.parse(input);
    await requireTripRole(user.id, values.tripId, ["owner"]);

    const trip = await tripSummary(values.tripId);
    if (!trip) throw new TripAccessError("That trip no longer exists.");

    const email = values.email.trim().toLowerCase();
    if (email === user.email.toLowerCase()) {
      throw new TripAccessError("You are already a member of this trip.");
    }

    const existingMember = await getD1()
      .prepare(
        `select m.id from trip_members m join "user" u on u.id = m.user_id
         where m.trip_id = ? and lower(u.email) = ?`,
      )
      .bind(values.tripId, email)
      .first<{ id: string }>();
    if (existingMember) {
      throw new TripAccessError("That person is already a member of this trip.");
    }

    const pending = await getD1()
      .prepare(
        `select id from trip_invitations
         where trip_id = ? and lower(invitee_email) = ? and status = 'pending' and expires_at > ?`,
      )
      .bind(values.tripId, email, Date.now())
      .first<{ id: string }>();
    if (pending) {
      throw new TripAccessError("There is already a pending invitation for that email address.");
    }

    const invitee = await getD1()
      .prepare(`select id, name from "user" where lower(email) = ?`)
      .bind(email)
      .first<{ id: string; name: string }>();

    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const id = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 14 * 24 * 60 * 60 * 1000;
    await getD1()
      .prepare(
        `insert into trip_invitations (id, trip_id, inviter_id, invitee_email, invitee_name, invitee_user_id, role, token, status, created_at, expires_at, responded_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, null)`,
      )
      .bind(
        id,
        values.tripId,
        user.id,
        email,
        values.name || invitee?.name || email.split("@")[0],
        invitee?.id ?? null,
        values.role,
        token,
        now,
        expiresAt,
      )
      .run();

    if (invitee) {
      await notifyUsers([invitee.id], {
        type: "invitation",
        title: `${user.name} invited you to ${trip.name}`,
        body: "Open Invitations to accept or decline.",
        href: "/preview/invitations",
      });
    }

    let emailState: "sent" | "failed" | "unconfigured" = "unconfigured";
    if (isEmailConfigured()) {
      const base = (getBindings().BETTER_AUTH_URL ?? "http://localhost:3000").replace(
        /\/+$/,
        "",
      );
      emailState = "failed";
      try {
        await sendEmail({
          to: email,
          subject: `${user.name} invited you to ${trip.name} on TripSync`,
          text: [
            `${user.name} (${user.email}) invited you to join ${trip.name}.`,
            "",
            `Destination: ${trip.destination}`,
            `Dates: ${trip.start_date} to ${trip.end_date}`,
            `Your role once accepted: ${values.role === "viewer" ? "viewer (read only)" : "editor (can change the itinerary)"}`,
            "",
            `Open the invitation: ${base}/invite/${token}`,
            "",
            "The link expires in 14 days. You will need to sign in or create a free TripSync account with this email address to accept it.",
            "If you were not expecting this invitation, you can ignore this email.",
            emailSignOff,
          ].join("\n"),
        });
        emailState = "sent";
      } catch {
        // The invitation itself is safely stored; only delivery failed.
      }
    }

    return await done(
      user.id,
      emailState === "sent"
        ? `Invitation emailed to ${email}.`
        : emailState === "failed"
          ? `Invitation created and saved, but the email could not be delivered. Copy the invitation link below and share it directly.`
          : "Invitation created and saved. Email delivery is not configured, so copy the invitation link and share it directly.",
    );
  } catch (error) {
    return failure(error);
  }
}

async function respondToInvitation(
  user: SessionUser,
  invitation: {
    id: string;
    trip_id: string;
    inviter_id: string;
    role: string;
    status: string;
    expires_at: number;
    trip_name: string;
  },
  response: "accepted" | "declined",
): Promise<ActionResult> {
  if (invitation.status !== "pending") {
    throw new TripAccessError("This invitation has already been answered.");
  }
  if (invitation.expires_at < Date.now()) {
    await getD1()
      .prepare(`update trip_invitations set status = 'expired' where id = ?`)
      .bind(invitation.id)
      .run();
    throw new TripAccessError("This invitation has expired. Ask the owner for a new one.");
  }

  const now = Date.now();
  if (response === "declined") {
    await getD1()
      .prepare(`update trip_invitations set status = 'declined', responded_at = ? where id = ?`)
      .bind(now, invitation.id)
      .run();
    await notifyUsers([invitation.inviter_id], {
      type: "invitation",
      title: `${user.name} declined the invitation to ${invitation.trip_name}`,
      href: "/preview/trips",
    });
    await emailEvent(
      invitation.inviter_id,
      "invitations",
      `${user.name} declined your invitation to ${invitation.trip_name}`,
      [
        `${user.name} (${user.email}) declined the invitation.`,
        "You can invite someone else whenever you like.",
      ],
      "/preview/trips",
    );
    return await done(user.id, "Invitation declined. The trip was not added to your workspace.");
  }
  const role = invitation.role === "viewer" ? "viewer" : "editor";
  const db = getD1();
  await db.batch([
    db
      .prepare(
        `insert into trip_members (id, trip_id, user_id, role, joined_at)
         values (?, ?, ?, ?, ?)
         on conflict(trip_id, user_id) do nothing`,
      )
      .bind(crypto.randomUUID(), invitation.trip_id, user.id, role, now),
    db
      .prepare(
        `update trip_invitations set status = 'accepted', responded_at = ?, invitee_user_id = ? where id = ?`,
      )
      .bind(now, user.id, invitation.id),
  ]);

  await notifyUsers([invitation.inviter_id], {
    type: "membership",
    title: `${user.name} joined ${invitation.trip_name}`,
    body: `They joined as ${role === "viewer" ? "a viewer" : "an editor"}.`,
    href: `/preview/trips/${invitation.trip_id}`,
  });
  await emailEvent(
    invitation.inviter_id,
    "invitations",
    `${user.name} joined ${invitation.trip_name}`,
    [
      `${user.name} (${user.email}) accepted your invitation and joined as ${role === "viewer" ? "a viewer (read only)" : "an editor"}.`,
    ],
    `/preview/trips/${invitation.trip_id}`,
  );    await logActivity(
      invitation.trip_id,
      user.id,
      "member.joined",
      `${user.name} joined as ${role === "viewer" ? "a viewer" : "an editor"}`,
    );
    return await done(
      user.id,
      `You joined ${invitation.trip_name}. It is now in My trips.`,
      invitation.trip_id,
    );
}

export async function respondToInvitationAction(
  invitationId: string,
  response: "accepted" | "declined",
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const invitation = await getD1()
      .prepare(
        `select i.id, i.trip_id, i.inviter_id, i.role, i.status, i.expires_at, t.name as trip_name
         from trip_invitations i join trips t on t.id = i.trip_id
         where i.id = ? and lower(i.invitee_email) = lower(?)`,
      )
      .bind(invitationId, user.email)
      .first<{
        id: string;
        trip_id: string;
        inviter_id: string;
        role: string;
        status: string;
        expires_at: number;
        trip_name: string;
      }>();
    if (!invitation) throw new TripAccessError("This invitation is not addressed to your account.");
    return await respondToInvitation(user, invitation, response);
  } catch (error) {
    return failure(error);
  }
}

export async function acceptInvitationTokenAction(
  token: string,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const invitation = await getD1()
      .prepare(
        `select i.id, i.trip_id, i.inviter_id, i.role, i.status, i.expires_at, i.invitee_email,
                t.name as trip_name
         from trip_invitations i join trips t on t.id = i.trip_id
         where i.token = ?`,
      )
      .bind(token)
      .first<{
        id: string;
        trip_id: string;
        inviter_id: string;
        role: string;
        status: string;
        expires_at: number;
        invitee_email: string;
        trip_name: string;
      }>();
    if (!invitation) throw new TripAccessError("That invitation link is not valid.");
    if (invitation.invitee_email.toLowerCase() !== user.email.toLowerCase()) {
      throw new TripAccessError(
        `This invitation was sent to ${invitation.invitee_email}. Sign in with that address to accept it.`,
      );
    }
    return await respondToInvitation(user, invitation, "accepted");
  } catch (error) {
    return failure(error);
  }
}

export async function declineInvitationTokenAction(
  token: string,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const invitation = await getD1()
      .prepare(
        `select i.id, i.trip_id, i.inviter_id, i.role, i.status, i.expires_at, i.invitee_email,
                t.name as trip_name
         from trip_invitations i join trips t on t.id = i.trip_id
         where i.token = ?`,
      )
      .bind(token)
      .first<{
        id: string;
        trip_id: string;
        inviter_id: string;
        role: string;
        status: string;
        expires_at: number;
        invitee_email: string;
        trip_name: string;
      }>();
    if (!invitation) throw new TripAccessError("That invitation link is not valid.");
    if (invitation.invitee_email.toLowerCase() !== user.email.toLowerCase()) {
      throw new TripAccessError(
        `This invitation was sent to ${invitation.invitee_email}. Sign in with that address to answer it.`,
      );
    }
    return await respondToInvitation(user, invitation, "declined");
  } catch (error) {
    return failure(error);
  }
}

export async function revokeInvitationAction(
  invitationId: string,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const invitation = await getD1()
      .prepare(`select trip_id from trip_invitations where id = ?`)
      .bind(invitationId)
      .first<{ trip_id: string }>();
    if (!invitation) throw new TripAccessError("That invitation no longer exists.");
    await requireTripRole(user.id, invitation.trip_id, ["owner"]);
    await getD1()
      .prepare(`update trip_invitations set status = 'revoked' where id = ? and status = 'pending'`)
      .bind(invitationId)
      .run();
    return await done(user.id, "Invitation withdrawn.");
  } catch (error) {
    return failure(error);
  }
}

/* --------------------------------------------------------- trip members */

/**
 * Changes a member's access role. Only the trip owner may do this, and the
 * owner row itself is immutable — a trip always keeps its owner.
 */
export async function updateMemberRoleAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = memberRoleSchema.parse(input);
    await requireTripRole(user.id, values.tripId, ["owner"]);
    const db = getD1();
    const membership = await db
      .prepare(
        `select m.role, u.name from trip_members m join "user" u on u.id = m.user_id
         where m.trip_id = ? and m.user_id = ?`,
      )
      .bind(values.tripId, values.userId)
      .first<{ role: string; name: string }>();
    if (!membership) {
      throw new TripAccessError("That person is not a member of this trip.");
    }
    if (membership.role === "owner" || values.userId === user.id) {
      throw new TripAccessError(
        "The owner's role cannot be changed. Ownership transfer is not supported.",
      );
    }
    if (membership.role === values.role) {
      throw new TripAccessError(
        `They already have ${values.role === "viewer" ? "view-only" : "editing"} access.`,
      );
    }
    await db
      .prepare(`update trip_members set role = ? where trip_id = ? and user_id = ?`)
      .bind(values.role, values.tripId, values.userId)
      .run();

    const trip = await tripSummary(values.tripId);
    await notifyUsers([values.userId], {
      type: "membership",
      title: `Your access to ${trip?.name ?? "a trip"} changed`,
      body:
        values.role === "viewer"
          ? "You now have view-only access."
          : "You can now edit the itinerary.",
      href: `/preview/trips/${values.tripId}`,
    });
    await emailEvent(
      values.userId,
      "tripUpdates",
      `Your access to ${trip?.name ?? "a trip"} changed`,
      [
        values.role === "viewer"
          ? "You now have view-only access to this trip."
          : "You can now edit the itinerary for this trip.",
      ],
      `/preview/trips/${values.tripId}`,
    );

    await logActivity(
      values.tripId,
      user.id,
      "member.role",
      `${membership.name} is now ${values.role === "viewer" ? "a viewer" : "an editor"}`,
    );
    return await done(
      user.id,
      `${membership.name.split(" ")[0]} is now ${values.role === "viewer" ? "a viewer" : "an editor"}.`,
    );
  } catch (error) {
    return failure(error);
  }
}

/**
 * Removes a member from a trip. Only the owner may do this, the owner row is
 * never removable, and access is revoked immediately because every request
 * re-reads membership from the database.
 */
export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = memberRemoveSchema.parse(input);
    await requireTripRole(user.id, values.tripId, ["owner"]);
    if (values.userId === user.id) {
      throw new TripAccessError(
        "You own this trip, so you cannot remove yourself. Delete the trip instead.",
      );
    }
    const db = getD1();
    const membership = await db
      .prepare(
        `select m.role, u.name from trip_members m join "user" u on u.id = m.user_id
         where m.trip_id = ? and m.user_id = ?`,
      )
      .bind(values.tripId, values.userId)
      .first<{ role: string; name: string }>();
    if (!membership) {
      throw new TripAccessError("That person is not a member of this trip.");
    }
    if (membership.role === "owner") {
      throw new TripAccessError("The trip owner cannot be removed from their own trip.");
    }
    await db
      .prepare(`delete from trip_members where trip_id = ? and user_id = ?`)
      .bind(values.tripId, values.userId)
      .run();

    const trip = await tripSummary(values.tripId);
    await notifyUsers([values.userId], {
      type: "membership",
      title: `You were removed from ${trip?.name ?? "a trip"}`,
      body: "Your access to that trip has ended.",
      href: "/preview/trips",
    });
    await emailEvent(
      values.userId,
      "tripUpdates",
      `You were removed from ${trip?.name ?? "a trip"}`,
      [
        "Your access to this trip has ended.",
        "If this looks wrong, contact the trip owner.",
      ],
      "/preview/trips",
    );

    await logActivity(
      values.tripId,
      user.id,
      "member.removed",
      `Removed ${membership.name} from the trip`,
    );
    return await done(
      user.id,
      `${membership.name.split(" ")[0]} was removed. Their access ended immediately.`,
    );
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------- feedback, notifications */

export async function submitFeedbackAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const values = feedbackSchema.parse(input);
    const db = getD1();

    // Feedback is append-only, so a double click would otherwise create two
    // identical rows. One submission per minute is the product's policy;
    // people can share more feedback later through the same form.
    const latest = await db
      .prepare(
        `select created_at from feedback where user_id = ? order by created_at desc limit 1`,
      )
      .bind(user.id)
      .first<{ created_at: number }>();
    if (latest && Date.now() - latest.created_at < 60_000) {
      throw new TripAccessError(
        "Your last feedback was just saved. You can share more in a minute.",
      );
    }

    await db
      .prepare(
        `insert into feedback (id, user_id, rating, message, created_at) values (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), user.id, values.rating, values.comment, Date.now())
      .run();
    return await done(user.id, "Thanks — your feedback was saved.");
  } catch (error) {
    return failure(error);
  }
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const id = notificationIdSchema.parse(notificationId);
    await getD1()
      .prepare(`update notifications set read_at = coalesce(read_at, ?) where id = ? and user_id = ?`)
      .bind(Date.now(), id, user.id)
      .run();
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

export async function markNotificationUnreadAction(
  notificationId: string,
): Promise<ActionResult> {
  try {
    const user = await currentUser();
    const id = notificationIdSchema.parse(notificationId);
    await getD1()
      .prepare(`update notifications set read_at = null where id = ? and user_id = ?`)
      .bind(id, user.id)
      .run();
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await currentUser();
    await getD1()
      .prepare(`update notifications set read_at = ? where user_id = ? and read_at is null`)
      .bind(Date.now(), user.id)
      .run();
    return await done(user.id);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Returns the next page of the caller's own notifications, strictly older than
 * the cursor. Only the signed-in user's rows are ever read — there is no way to
 * ask for somebody else's page.
 */
// Emit a fresh workspace snapshot with every notification mutation so the
// client never has to choose between a stale list and a silently dropped row.
export async function loadOlderNotificationsAction(beforeCreatedAt: string): Promise<
  { ok: true; items: AppNotification[] } | { ok: false; error: string }
> {
  try {
    const user = await currentUser();
    const before = Date.parse(beforeCreatedAt);
    if (!Number.isFinite(before)) {
      return { ok: false, error: "That position in the list is not valid." };
    }
    const items = await loadNotificationsBefore(user.id, before);
    return { ok: true, items };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : "Older notifications could not be loaded. Try again.",
    };
  }
}

/* --------------------------------------------------- account security flow */

export async function changePasswordAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await currentUser();
    const values = passwordChangeSchema.parse(input);
    const { headers } = await import("next/headers");
    const { getAuth } = await import("./auth");
    await getAuth().api.changePassword({
      body: {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: firstIssue(error) };
    const message =
      error instanceof Error && /invalid password/i.test(error.message)
        ? "That current password is not correct."
        : "The password could not be changed. Check the current password and try again.";
    return { ok: false, error: message };
  }
}

export async function deleteAccountAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await currentUser();
    const values = accountDeleteSchema.parse(input);
    if (values.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return { ok: false, error: "The email address does not match this account." };
    }
    // Role changes refuse self-demotion so at least one admin always remains;
    // deleting the account must not be a side door around that rule.
    if (user.role === "admin") {
      const otherAdmin = await getD1()
        .prepare(`select id from "user" where role = 'admin' and id != ? limit 1`)
        .bind(user.id)
        .first<{ id: string }>();
      if (!otherAdmin) {
        return {
          ok: false,
          error:
            "You are the only platform admin. Promote another account to admin before deleting this one.",
        };
      }
    }
    // Deleting the account cascades to sessions, trips they own, memberships,
    // invitations and notifications. Trips they merely joined stay with their
    // owners; only this user's membership row is removed.
    if (user.role === "admin") {
      await audit(user.id, "account.delete", user.id, "self-deleted admin account");
    }
    await getD1().prepare(`delete from "user" where id = ?`).bind(user.id).run();
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: firstIssue(error) };
    return { ok: false, error: "The account could not be deleted. Please try again." };
  }
}

