/**
 * Domain types for TripSync.
 *
 * These mirror the tables described in section 8 of the PRD. The current
 * frontend-only stage keeps records in browser memory; the same shapes can be
 * mapped to database rows later without rewriting the UI contracts.
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // ISO 8601 timestamp
export type TripRole = "owner" | "member";
/** What a member is allowed to do inside a trip, enforced on the server. */
export type TripAccessRole = "owner" | "editor" | "viewer";
export type TripStatus = "upcoming" | "ongoing" | "completed";
export type PlatformRole = "user" | "admin";
export type AvatarTone = "forest" | "clay" | "sage" | "sand" | "ink";

export interface Member {
  id: string;
  name: string;
  email: string;
  initials: string;
  tone: AvatarTone;
  role: TripRole;
  /** Editor/viewer distinction; absent on sample content predating it. */
  access?: TripAccessRole;
  /** True when this member is the signed-in user. */
  isCurrentUser?: boolean;
}

/** One event in a trip's shared history, written by the action that did it. */
export interface TripActivity {
  id: string;
  kind: string;
  summary: string;
  /** The member who made the change; absent once that account is gone. */
  actorName?: string;
  createdAt: ISODateTime;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  region: string;
  startDate: ISODate;
  endDate: ISODate;
  /** Planned party size. `null` falls back to the number of joined members. */
  travellerCount?: number | null;
  description: string;
  /** Whole rupees. `null` means the group has not set a budget yet. */
  budget: number | null;
  currency: "INR";
  coverImage: string;
  coverAlt: string;
  ownerId: string;
  members: Member[];
  createdAt: ISODate;
  /** Millisecond creation timestamp; drives the "recently added" sort. */
  createdMs?: number;
  /** Millisecond edit timestamp; drives the "recently updated" sort. */
  updatedMs?: number;
  /**
   * The read-only example trip. It can be explored and copied, but its
   * itinerary and records are never changed by the demo actions.
   */
  isDemo?: boolean;
  /** Most recent events first; empty when nothing has happened yet. */
  activity?: TripActivity[];
}

export type ActivityCategory =
  | "Food"
  | "Stay"
  | "Transport"
  | "Activity"
  | "Sightseeing"
  | "Shopping"
  | "Free time";

export interface ItineraryItem {
  id: string;
  tripId: string;
  date: ISODate;
  startTime: string; // HH:mm, 24-hour
  endTime?: string;
  title: string;
  description?: string;
  location: string;
  /** Street address or landmark, when the place name alone is not enough. */
  address?: string;
  /** Optional map link, opened in a new tab. */
  mapUrl?: string;
  /** Optional reference link: a ticket page, menu or guide. */
  referenceUrl?: string;
  estimatedCost?: number;
  category: ActivityCategory;
  createdBy: string;
  /** Persisted position within its day; the itinerary reads this order. */
  sortOrder?: number;
  /** "ai" when the activity came from the AI planner, so it stays labelled
   *  after saving instead of reading as a confirmed fact. */
  source?: "ai" | "manual";
  /** Millisecond edit timestamp; guards against silently overwriting a
   *  change another member saved while this editor had the form open. */
  updatedMs?: number;
}

export type ExpenseCategory =
  | "Stay"
  | "Food"
  | "Transport"
  | "Activities"
  | "Shopping"
  | "Other";

export interface Expense {
  id: string;
  tripId: string;
  description: string;
  /** Whole rupees, always greater than zero. */
  amount: number;
  category: ExpenseCategory;
  date: ISODate;
  payerId: string;
  participantIds: string[];
  /** Optional note the group can attach to the record. */
  notes?: string;
  /** Persisted share of the cost per member, in rupees, from `expense_splits`. */
  shares?: Record<string, number>;
}

export interface PollOption {
  id: string;
  label: string;
  voterIds: string[];
}

export interface Poll {
  id: string;
  tripId: string;
  question: string;
  /** Optional context shown under the question. */
  description?: string;
  options: PollOption[];
  createdBy: string;
  closesAt?: ISODateTime;
  /** `expired` means the closing date passed; voting is closed either way. */
  status: "open" | "closed" | "expired";
}

export type PackingCategory =
  | "Essentials"
  | "Clothing"
  | "Gear"
  | "Health"
  | "Documents";

export interface PackingItem {
  id: string;
  tripId: string;
  name: string;
  quantity: number;
  packed: boolean;
  assignedTo?: string;
  category: PackingCategory;
  notes?: string;
}

export type NoteCategory =
  | "General"
  | "Bookings"
  | "Transport"
  | "Food"
  | "Contacts"
  | "Other";

export interface TripNote {
  id: string;
  tripId: string;
  authorId: string;
  title: string;
  body: string;
  category?: NoteCategory;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export interface Invitation {
  id: string;
  /** Secure token used by the shareable invitation link. */
  token?: string;
  role?: TripAccessRole;
  tripId?: string;
  tripName: string;
  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  inviterName: string;
  inviteeName: string;
  inviteeEmail: string;
  memberCount?: number;
  status: InvitationStatus;
  sentAt: ISODate;
  expiresAt: ISODate;
  kind: "received" | "sent";
}

/** In-app notification switches. Every one is on unless the user turns it off. */
export interface NotificationPreferences {
  invitations: boolean;
  tripUpdates: boolean;
  polls: boolean;
  budget: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  initials: string;
  tone: AvatarTone;
  platformRole: PlatformRole;
  homeCity: string;
  joinedAt: ISODate;
  travelStyle: "Relaxed" | "Balanced" | "Packed";
  dietaryNotes: string;
  notificationPreferences: NotificationPreferences;
  /** Set once the tour is completed or skipped; absent means it still shows. */
  onboardingCompletedAt?: ISODateTime;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  tripCount: number;
  joinedAt: ISODate;
  status: "Active" | "Invited";
}

export interface FeedbackEntry {
  id: string;
  rating: number;
  comment: string;
  createdAt: ISODateTime;
  authorName?: string;
  authorEmail?: string;
}

export type NotificationType =
  | "invitation"
  | "membership"
  | "poll"
  | "budget"
  | "itinerary";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  readAt?: ISODateTime;
  createdAt: ISODateTime;
}
