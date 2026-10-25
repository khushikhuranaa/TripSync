import {
  expenses as sampleExpenses,
  itinerary as sampleItinerary,
  notes as sampleNotes,
  packingItems as samplePackingItems,
  polls as samplePolls,
  trips as sampleTrips,
} from "@/lib/sample-data";
import { rupeesToMinor } from "@/lib/money";
import {
  TEMPLATE_TRIP_ID,
  TEMPLATE_TRIP_NAME,
} from "@/lib/workspace";
import type {
  Expense,
  ItineraryItem,
  PackingItem,
  Poll,
  Trip,
  TripNote,
} from "@/lib/types";
import { getD1 } from "./db";

/**
 * The example trip is curated content, not a row owned by another person.
 * Keeping it in code means no fake accounts exist, and no user can edit it.
 * Copying it creates ordinary rows that belong to the signed-in user.
 */

const templateTrip = sampleTrips.find((trip) => trip.id === TEMPLATE_TRIP_ID);

if (!templateTrip) {
  throw new Error("The curated example trip is missing from sample-data.");
}

export const template: Trip = {
  ...templateTrip,
  id: TEMPLATE_TRIP_ID,
  name: TEMPLATE_TRIP_NAME,
  isDemo: true,
  members: templateTrip.members.map((member) => ({
    ...member,
    access: member.role === "owner" ? "owner" : "editor",
  })),
};

export const templateItinerary: ItineraryItem[] = sampleItinerary.filter(
  (item) => item.tripId === TEMPLATE_TRIP_ID,
);
export const templateExpenses: Expense[] = sampleExpenses.filter(
  (item) => item.tripId === TEMPLATE_TRIP_ID,
);
export const templatePolls: Poll[] = samplePolls.filter(
  (item) => item.tripId === TEMPLATE_TRIP_ID,
);
export const templatePacking: PackingItem[] = samplePackingItems.filter(
  (item) => item.tripId === TEMPLATE_TRIP_ID,
);
export const templateNotes: TripNote[] = sampleNotes.filter(
  (item) => item.tripId === TEMPLATE_TRIP_ID,
);

/**
 * Copy the example trip into the signed-in user's account.
 *
 * The inserts are sent as one atomic transaction, so a failure leaves no
 * half-copied trip behind. The copy is independent: editing it never touches
 * the curated template.
 */
export async function copyTemplateForUser(
  userId: string,
  options: { name?: string } = {},
) {
  const db = getD1();
  const now = Date.now();
  const tripId = crypto.randomUUID();
  const name = options.name?.trim() || `${TEMPLATE_TRIP_NAME} (my copy)`;

  const statements = [
    db
      .prepare(
        `insert into trips (id, owner_id, name, destination, region, description, start_date, end_date, traveller_count, budget_minor, currency, cover_image, cover_alt, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?)`,
      )
      .bind(
        tripId,
        userId,
        name,
        template.destination,
        template.region,
        template.description,
        template.startDate,
        template.endDate,
        template.members.length,
        template.budget === null ? null : rupeesToMinor(template.budget),
        template.coverImage,
        template.coverAlt,
        now,
        now,
      ),
    db
      .prepare(
        `insert into trip_members (id, trip_id, user_id, role, joined_at)
         values (?, ?, ?, 'owner', ?)`,
      )
      .bind(crypto.randomUUID(), tripId, userId, now),
  ];

  // Positions restart per day so the copied itinerary keeps the curated order.
  const orderByDate = new Map<string, number>();
  for (const item of templateItinerary) {
    const order = orderByDate.get(item.date) ?? 0;
    orderByDate.set(item.date, order + 1);
    statements.push(
      db
        .prepare(
          `insert into itinerary_items (id, trip_id, day_date, start_time, end_time, title, place, description, cost_minor, category, sort_order, created_by, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          item.estimatedCost === undefined
            ? null
            : rupeesToMinor(item.estimatedCost),
          item.category,
          order,
          userId,
          now,
          now,
        ),
    );
  }

  for (const [index, item] of templatePacking.entries()) {
    statements.push(
      db
        .prepare(
          `insert into packing_items (id, trip_id, name, category, notes, quantity, assigned_to, packed, sort_order, created_by, created_at)
           values (?, ?, ?, ?, ?, ?, null, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          tripId,
          item.name,
          item.category,
          item.notes ?? null,
          item.quantity,
          item.packed,
          index,
          userId,
          now,
        ),
    );
  }

  for (const note of templateNotes) {
    statements.push(
      db
        .prepare(
          `insert into trip_notes (id, trip_id, author_id, title, body, category, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          tripId,
          userId,
          note.title,
          note.body,
          note.category ?? "General",
          now,
          now,
        ),
    );
  }

  for (const poll of templatePolls) {
    const pollId = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `insert into polls (id, trip_id, question, description, created_by, closes_at, status, created_at)
           values (?, ?, ?, ?, ?, null, 'open', ?)`,
        )
        .bind(
          pollId,
          tripId,
          poll.question,
          poll.description ?? "",
          userId,
          now,
        ),
    );
    for (const [index, option] of poll.options.entries()) {
      statements.push(
        db
          .prepare(
            `insert into poll_options (id, poll_id, label, sort_order)
             values (?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), pollId, option.label, index),
      );
    }
  }

  // The example trip belongs to five illustrative travellers. In a real
  // account only the signed-in person exists, so each copied expense is
  // recorded as paid by them and split across one participant. The copy is
  // fully editable so the amounts can be reassigned.
  for (const expense of templateExpenses) {
    const expenseId = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `insert into expenses (id, trip_id, description, amount_minor, currency, category, spent_on, paid_by, notes, created_by, created_at, updated_at)
           values (?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          expenseId,
          tripId,
          expense.description,
          rupeesToMinor(expense.amount),
          expense.category,
          expense.date,
          userId,
          expense.notes ?? null,
          userId,
          now,
          now,
        ),
    );
    statements.push(
      db
        .prepare(
          `insert into expense_splits (id, expense_id, user_id, share_minor)
           values (?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          expenseId,
          userId,
          rupeesToMinor(expense.amount),
        ),
    );
  }

  await db.batch(statements);
  return tripId;
}
