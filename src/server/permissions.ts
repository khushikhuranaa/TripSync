import type { TripAccessRole } from "@/lib/types";
import { isTemplateTrip } from "@/lib/workspace";
import { getD1 } from "./db";

/**
 * Authorisation is decided here, on the server, for every trip operation.
 * Hiding a button in the interface is a convenience, never the boundary.
 */

export class TripAccessError extends Error {
  constructor(message = "You do not have access to this trip.") {
    super(message);
    this.name = "TripAccessError";
  }
}

export class TemplateTripError extends Error {
  constructor() {
    super(
      "The example trip is read-only. Create your own copy to change anything.",
    );
    this.name = "TemplateTripError";
  }
}

export async function getTripRole(
  userId: string,
  tripId: string,
): Promise<TripAccessRole | null> {
  const row = await getD1()
    .prepare(`select role from trip_members where trip_id = ? and user_id = ?`)
    .bind(tripId, userId)
    .first<{ role: string }>();
  if (!row) return null;
  return row.role === "owner" || row.role === "viewer" ? row.role : "editor";
}

export async function requireTripRole(
  userId: string,
  tripId: string,
  allowed: readonly TripAccessRole[],
): Promise<TripAccessRole> {
  if (isTemplateTrip(tripId)) throw new TemplateTripError();
  const role = await getTripRole(userId, tripId);
  if (!role) throw new TripAccessError();
  if (!allowed.includes(role)) {
    throw new TripAccessError(
      role === "viewer"
        ? "Viewers can read this trip but cannot change it."
        : "Only the trip owner can do that.",
    );
  }
  return role;
}

/** Only real members may be referenced in expenses, assignments and polls. */
export async function requireMembers(tripId: string, userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    throw new TripAccessError("Choose at least one trip member.");
  }
  const { results } = await getD1()
    .prepare(
      `select user_id from trip_members
       where trip_id = ? and user_id in (${unique.map(() => "?").join(", ")})`,
    )
    .bind(tripId, ...unique)
    .all<{ user_id: string }>();
  const found = new Set((results ?? []).map((row) => row.user_id));
  if (unique.some((id) => !found.has(id))) {
    throw new TripAccessError("One of the selected people is not a member of this trip.");
  }
  return unique;
}

export async function getTripDates(tripId: string) {
  const row = await getD1()
    .prepare(`select start_date, end_date from trips where id = ?`)
    .bind(tripId)
    .first<{ start_date: string; end_date: string }>();
  if (!row) throw new TripAccessError();
  return { startDate: row.start_date, endDate: row.end_date };
}

/** Finds the trip behind a child record, e.g. an itinerary item or expense. */
export async function tripIdForChild(
  table: "itinerary_items" | "expenses" | "polls" | "packing_items" | "trip_notes",
  id: string,
): Promise<string> {
  const row = await getD1()
    .prepare(`select trip_id from ${table} where id = ?`)
    .bind(id)
    .first<{ trip_id: string }>();
  if (!row) throw new TripAccessError("That record no longer exists.");
  return row.trip_id;
}
