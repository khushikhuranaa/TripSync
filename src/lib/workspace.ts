import type {
  AdminUser,
  AppNotification,
  Expense,
  FeedbackEntry,
  Invitation,
  ItineraryItem,
  PackingItem,
  Poll,
  Profile,
  Trip,
  TripNote,
} from "@/lib/types";

/** Everything the signed-in user is allowed to see, in one serializable object. */
export interface WorkspaceState {
  trips: Trip[];
  itinerary: ItineraryItem[];
  expenses: Expense[];
  polls: Poll[];
  packingItems: PackingItem[];
  notes: TripNote[];
  invitations: Invitation[];
  profile: Profile;
  /** Admin-only: every account and its trip count. Empty for normal users. */
  users: AdminUser[];
  /** Admin-only: every feedback entry. Empty for normal users. */
  feedback: FeedbackEntry[];
  /** Admin-only: every trip on the platform. Empty for normal users. */
  adminTrips: Trip[];
  notifications: AppNotification[];
}

export type ActionResult =
  | {
      ok: true;
      state: WorkspaceState;
      notice?: string;
      /** Set by create/copy/accept so the interface can open the new trip. */
      createdTripId?: string;
    }
  | { ok: false; error: string };

/** The curated, read-only example trip lives in code, never in another user's rows. */
export const TEMPLATE_TRIP_ID = "goa";
export const TEMPLATE_TRIP_NAME = "Goa in December";

export function isTemplateTrip(tripId: string) {
  return tripId === TEMPLATE_TRIP_ID;
}
