"use client";

/**
 * The shared workspace store, backed by the database.
 *
 * The server loads the workspace once per request (see
 * `src/app/preview/layout.tsx`) and hands it to `DemoProvider` as
 * `initialState`, so the first client render already shows real rows. Every
 * mutation calls a server action; the action validates the input, checks the
 * caller's role for the exact record, writes to D1 and returns the fresh
 * workspace, which replaces the local state. Nothing is mirrored into browser
 * storage: the database is the source of truth, so a refresh, another device
 * or a new session always sees the same records.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type {
  ActivityCategory,
  AppNotification,
  ExpenseCategory,
  ItineraryItem,
  NoteCategory,
  PackingCategory,
  PlatformRole,
  Trip,
} from "@/lib/types";
import {
  isTemplateTrip,
  type ActionResult,
  type WorkspaceState,
} from "@/lib/workspace";
import {
  addDraftItemsAction,
  addExpenseAction,
  addItineraryItemAction,
  addNoteAction,
  addPackingItemAction,
  closePollAction,
  copyTemplateAction,
  createPollAction,
  createTripAction,
  deleteExpenseAction,
  deleteItineraryItemAction,
  deleteNoteAction,
  deletePackingItemAction,
  deleteTripAction,
  leaveTripAction,
  loadOlderNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  moveItineraryItemAction,
  removeMemberAction,
  respondToInvitationAction,
  revokeInvitationAction,
  sendInvitationAction,
  setUserRoleAction,
  submitFeedbackAction,
  togglePackingItemAction,
  updateExpenseAction,
  updateItineraryItemAction,
  updateMemberRoleAction,
  updateNoteAction,
  updatePackingItemAction,
  updateTripAction,
  votePollAction,
} from "@/server/actions";

export const tripCovers = [
  {
    value: "/images/goa-palolem.jpg",
    label: "Palm-lined beach",
    alt: "Palm trees and fishing boats along Palolem beach in south Goa",
  },
  {
    value: "/images/jaipur-hawa-mahal.jpg",
    label: "Pink city palace",
    alt: "The pink sandstone facade of Hawa Mahal in Jaipur",
  },
  {
    value: "/images/kerala-houseboat.jpg",
    label: "Backwater houseboat",
    alt: "A traditional thatched houseboat moored on the Kerala backwaters",
  },
  {
    value: "/images/coorg-hills.jpg",
    label: "Green hill country",
    alt: "Green paddy fields and forested hills in Coorg, Karnataka",
  },
  {
    value: "/images/manali-mountains.jpg",
    label: "Himalayan peaks",
    alt: "Snow-covered Himalayan peaks above Manali in Himachal Pradesh",
  },
] as const;

export function coverForDestination(destination: string) {
  const value = destination.toLowerCase();
  if (value.includes("goa") || value.includes("beach")) return tripCovers[0];
  if (
    value.includes("jaipur") ||
    value.includes("udaipur") ||
    value.includes("rajasthan") ||
    value.includes("leh")
  ) {
    return tripCovers[1];
  }
  if (value.includes("kerala") || value.includes("kochi")) return tripCovers[2];
  if (value.includes("manali") || value.includes("himachal") || value.includes("ladakh")) {
    return tripCovers[4];
  }
  return tripCovers[3];
}

export interface TripFormValues {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: string;
  travellers: string;
  description: string;
  coverImage: string;
}

/** How an expense is divided between the people who shared it. */
export type ExpenseSplitMode = "equal" | "amount" | "percent";

export interface ExpenseFormValues {
  description: string;
  amount: string;
  category: ExpenseCategory;
  date: string;
  payerId: string;
  participantIds: string[];
  notes: string;
  splitMode: ExpenseSplitMode;
  /** Raw per-member input when the split is custom; ignored for equal. */
  shareInputs: Record<string, string>;
}

/**
 * Converts the dialog's custom-split inputs into the rupees owed per person.
 *
 * Percentages are apportioned in paise and any leftover paise go to the largest
 * shares, so what the server receives always adds up to the expense total. The
 * dialog checks that percentages reach 100% and amounts reach the total before
 * this runs; the server checks the total again, independently.
 */
function expenseSharesFor(
  values: ExpenseFormValues,
): Record<string, number> | undefined {
  if (values.splitMode === "equal") return undefined;
  const totalMinor = Math.round(Number(values.amount) * 100);
  const people = values.participantIds;
  if (!Number.isFinite(totalMinor) || totalMinor <= 0 || people.length === 0) {
    return undefined;
  }

  if (values.splitMode === "amount") {
    return Object.fromEntries(
      people.map((id) => [
        id,
        Math.round(Number(values.shareInputs[id] ?? "0") * 100) / 100,
      ]),
    );
  }

  const weights = people.map((id) =>
    Math.max(0, Number(values.shareInputs[id] ?? "0")),
  );
  const minor = people.map((_, index) =>
    Math.floor((totalMinor * weights[index]) / 100),
  );
  let leftover = totalMinor - minor.reduce((total, value) => total + value, 0);
  const byWeight = people
    .map((id, index) => ({ index, weight: weights[index] }))
    .sort((a, b) => b.weight - a.weight);
  for (const entry of byWeight) {
    if (leftover <= 0) break;
    minor[entry.index] += 1;
    leftover -= 1;
  }
  return Object.fromEntries(people.map((id, index) => [id, minor[index] / 100]));
}

/** The exact payload the server action expects for an expense. */
function expenseActionValues(values: ExpenseFormValues) {
  const shares = expenseSharesFor(values);
  return {
    description: values.description,
    amount: values.amount,
    category: values.category,
    date: values.date,
    payerId: values.payerId,
    participantIds: values.participantIds,
    notes: values.notes,
    ...(shares ? { shares } : {}),
  };
}

export interface ActivityFormValues {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  mapUrl: string;
  referenceUrl: string;
  estimatedCost: string;
  description: string;
  category: ActivityCategory;
  /** The edit timestamp the form was opened with, when editing. */
  expectedUpdatedAt?: number;
}

export interface PackingFormValues {
  name: string;
  quantity: string;
  category: PackingCategory;
  assignedTo: string;
  notes: string;
}

export interface NoteFormValues {
  title: string;
  body: string;
  category: NoteCategory;
}

/** The workspace is exactly what the server is willing to show this user. */
export type DemoState = WorkspaceState;

type ToastTone = "success" | "info" | "error";

interface ToastState {
  id: string;
  message: string;
  tone: ToastTone;
}

/**
 * Every mutation is async because every mutation is a server round trip.
 * Functions that navigate return the created entity; the rest answer "did the
 * server accept it". Failures have already been surfaced as a toast by `run`,
 * so callers only act on success.
 */
interface DemoContextValue {
  state: DemoState;
  notify: (message: string, tone?: ToastTone) => void;
  createTrip: (values: TripFormValues) => Promise<Trip | null>;
  updateTrip: (tripId: string, values: TripFormValues) => Promise<boolean>;
  deleteTrip: (tripId: string) => Promise<boolean>;
  leaveTrip: (tripId: string) => Promise<boolean>;
  copyTrip: (tripId: string) => Promise<Trip | null>;
  addItineraryItem: (
    tripId: string,
    values: ActivityFormValues,
  ) => Promise<boolean>;
  updateItineraryItem: (
    itemId: string,
    values: ActivityFormValues,
  ) => Promise<boolean>;
  deleteItineraryItem: (itemId: string) => Promise<boolean>;
  addDraftItems: (
    tripId: string,
    items: Omit<ItineraryItem, "id" | "tripId" | "createdBy">[],
  ) => Promise<number>;
  addExpense: (tripId: string, values: ExpenseFormValues) => Promise<boolean>;
  updateExpense: (
    expenseId: string,
    values: ExpenseFormValues,
  ) => Promise<boolean>;
  deleteExpense: (expenseId: string) => Promise<boolean>;
  createPoll: (
    tripId: string,
    question: string,
    description: string,
    options: string[],
    closesAt: string,
  ) => Promise<boolean>;
  votePoll: (pollId: string, optionId: string) => Promise<boolean>;
  closePoll: (pollId: string) => Promise<boolean>;
  addPackingItem: (tripId: string, values: PackingFormValues) => Promise<boolean>;
  updatePackingItem: (
    itemId: string,
    values: PackingFormValues,
  ) => Promise<boolean>;
  togglePackingItem: (itemId: string) => Promise<boolean>;
  deletePackingItem: (itemId: string) => Promise<boolean>;
  addNote: (tripId: string, values: NoteFormValues) => Promise<boolean>;
  updateNote: (
    noteId: string,
    values: NoteFormValues,
    expectedUpdatedAt: string,
  ) => Promise<boolean>;
  deleteNote: (noteId: string) => Promise<boolean>;
  respondToInvitation: (
    invitationId: string,
    response: "accepted" | "declined",
  ) => Promise<Trip | null>;
  sendInvitation: (
    tripId: string,
    name: string,
    email: string,
    role?: "editor" | "viewer",
  ) => Promise<boolean>;
  moveItineraryItem: (
    itemId: string,
    direction: "up" | "down",
  ) => Promise<boolean>;
  revokeInvitation: (invitationId: string) => Promise<boolean>;
  updateMemberRole: (
    tripId: string,
    userId: string,
    role: "editor" | "viewer",
  ) => Promise<boolean>;
  removeMember: (tripId: string, userId: string) => Promise<boolean>;
  setUserRole: (userId: string, role: PlatformRole) => Promise<boolean>;
  submitFeedback: (rating: number, comment: string) => Promise<boolean>;
  markNotificationRead: (notificationId: string) => Promise<boolean>;
  markNotificationUnread: (notificationId: string) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<boolean>;
  loadOlderNotifications: (before: string) => Promise<AppNotification[]>;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function uid(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function DemoProvider({
  initialState,
  children,
}: {
  initialState: WorkspaceState;
  children: ReactNode;
}) {
  const [state, setState] = useState<DemoState>(initialState);
  const [renderedFrom, setRenderedFrom] = useState<WorkspaceState>(initialState);
  const [toast, setToast] = useState<ToastState | null>(null);
  const latestRequest = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    setToast({ id: uid("toast"), message, tone });
  }, []);

  // A server refresh (router.refresh, a redirect, a hard navigation) hands
  // over a new snapshot of the workspace. Adopt it while rendering — the
  // React-documented way to adjust state when a prop changes — so the
  // interface never drifts from what the database says.
  if (renderedFrom !== initialState) {
    setRenderedFrom(initialState);
    setState(initialState);
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  /**
   * Run one server action: publish its fresh workspace on success, raise its
   * message as a toast otherwise. Only the newest request may publish a
   * snapshot — a slower, older response arriving late would roll the
   * interface back to staler data.
   */
  const run = useCallback(
    async (action: Promise<ActionResult>): Promise<ActionResult> => {
      const request = ++latestRequest.current;
      const result = await action;
      if (result.ok) {
        if (request === latestRequest.current) setState(result.state);
        if (result.notice) notify(result.notice);
      } else {
        notify(result.error, "error");
      }
      return result;
    },
    [notify],
  );

  const value = useMemo<DemoContextValue>(() => {
    /** The trip a create/copy/accept action reports back, if it succeeded. */
    function createdTrip(result: ActionResult): Trip | null {
      if (!result.ok || !result.createdTripId) return null;
      return (
        result.state.trips.find((trip) => trip.id === result.createdTripId) ??
        null
      );
    }

    async function createTrip(values: TripFormValues): Promise<Trip | null> {
      const result = await run(
        createTripAction({
          name: values.name,
          destination: values.destination,
          startDate: values.startDate,
          endDate: values.endDate,
          budget: values.budget.trim(),
          travellers: values.travellers.trim() || "1",
          description: values.description,
          coverImage: values.coverImage,
        }),
      );
      return createdTrip(result);
    }

    async function updateTrip(tripId: string, values: TripFormValues) {
      const result = await run(
        updateTripAction(tripId, {
          name: values.name,
          destination: values.destination,
          startDate: values.startDate,
          endDate: values.endDate,
          budget: values.budget.trim(),
          travellers: values.travellers.trim() || "1",
          description: values.description,
          coverImage: values.coverImage,
        }),
      );
      return result.ok;
    }

    async function deleteTrip(tripId: string) {
      const result = await run(deleteTripAction(tripId));
      return result.ok;
    }

    async function leaveTrip(tripId: string) {
      const result = await run(leaveTripAction(tripId));
      return result.ok;
    }

    async function copyTrip(tripId: string): Promise<Trip | null> {
      if (!isTemplateTrip(tripId)) {
        notify("Use a trip's settings to edit it directly.", "info");
        return null;
      }
      const result = await run(copyTemplateAction({}));
      return createdTrip(result);
    }

    async function addItineraryItem(tripId: string, values: ActivityFormValues) {
      const result = await run(addItineraryItemAction(tripId, values));
      return result.ok;
    }

    async function updateItineraryItem(
      itemId: string,
      values: ActivityFormValues,
    ) {
      const result = await run(updateItineraryItemAction(itemId, values));
      return result.ok;
    }

    async function deleteItineraryItem(itemId: string) {
      const result = await run(deleteItineraryItemAction(itemId));
      return result.ok;
    }

    async function addDraftItems(
      tripId: string,
      items: Omit<ItineraryItem, "id" | "tripId" | "createdBy">[],
    ) {
      if (items.length === 0) return 0;
      const result = await run(addDraftItemsAction(tripId, items));
      return result.ok ? items.length : 0;
    }

    async function addExpense(tripId: string, values: ExpenseFormValues) {
      const result = await run(addExpenseAction(tripId, expenseActionValues(values)));
      return result.ok;
    }

    async function updateExpense(expenseId: string, values: ExpenseFormValues) {
      const result = await run(updateExpenseAction(expenseId, expenseActionValues(values)));
      return result.ok;
    }

    async function deleteExpense(expenseId: string) {
      const result = await run(deleteExpenseAction(expenseId));
      return result.ok;
    }

    async function createPoll(
      tripId: string,
      question: string,
      description: string,
      options: string[],
      closesAt: string,
    ) {
      const result = await run(
        createPollAction(tripId, { question, description, options, closesAt }),
      );
      return result.ok;
    }

    async function votePoll(pollId: string, optionId: string) {
      const result = await run(votePollAction({ pollId, optionId }));
      return result.ok;
    }

    async function closePoll(pollId: string) {
      const result = await run(closePollAction(pollId));
      return result.ok;
    }

    async function addPackingItem(tripId: string, values: PackingFormValues) {
      const result = await run(addPackingItemAction(tripId, values));
      return result.ok;
    }

    async function updatePackingItem(
      itemId: string,
      values: PackingFormValues,
    ) {
      const result = await run(updatePackingItemAction(itemId, values));
      return result.ok;
    }

    async function togglePackingItem(itemId: string) {
      const result = await run(togglePackingItemAction(itemId));
      return result.ok;
    }

    async function deletePackingItem(itemId: string) {
      const result = await run(deletePackingItemAction(itemId));
      return result.ok;
    }

    async function addNote(tripId: string, values: NoteFormValues) {
      const result = await run(addNoteAction(tripId, values));
      return result.ok;
    }

    async function updateNote(
      noteId: string,
      values: NoteFormValues,
      expectedUpdatedAt: string,
    ) {
      const result = await run(
        updateNoteAction(noteId, { ...values, expectedUpdatedAt }),
      );
      return result.ok;
    }

    async function deleteNote(noteId: string) {
      const result = await run(deleteNoteAction(noteId));
      return result.ok;
    }

    async function respondToInvitation(
      invitationId: string,
      response: "accepted" | "declined",
    ): Promise<Trip | null> {
      const result = await run(
        respondToInvitationAction(invitationId, response),
      );
      return createdTrip(result);
    }

    async function sendInvitation(
      tripId: string,
      name: string,
      email: string,
      role: "editor" | "viewer" = "editor",
    ) {
      const result = await run(sendInvitationAction({ tripId, name, email, role }));
      return result.ok;
    }

    async function moveItineraryItem(
      itemId: string,
      direction: "up" | "down",
    ) {
      const result = await run(moveItineraryItemAction(itemId, direction));
      return result.ok;
    }

    async function revokeInvitation(invitationId: string) {
      const result = await run(revokeInvitationAction(invitationId));
      return result.ok;
    }

    async function updateMemberRole(
      tripId: string,
      userId: string,
      role: "editor" | "viewer",
    ) {
      const result = await run(updateMemberRoleAction({ tripId, userId, role }));
      return result.ok;
    }

    async function removeMember(tripId: string, userId: string) {
      const result = await run(removeMemberAction({ tripId, userId }));
      return result.ok;
    }

    async function setUserRole(userId: string, role: PlatformRole) {
      const result = await run(setUserRoleAction({ userId, role }));
      return result.ok;
    }

    async function submitFeedback(rating: number, comment: string) {
      const result = await run(submitFeedbackAction({ rating, comment }));
      return result.ok;
    }

    async function markNotificationRead(notificationId: string) {
      const result = await run(markNotificationReadAction(notificationId));
      return result.ok;
    }

    async function markNotificationUnread(notificationId: string) {
      const result = await run(markNotificationUnreadAction(notificationId));
      return result.ok;
    }

    async function markAllNotificationsRead() {
      const result = await run(markAllNotificationsReadAction());
      return result.ok;
    }

    /**
     * Appends the next page of history below the current list. Older rows are
     * merged in locally because the workspace snapshot always reloads only the
     * most recent 30; a failure surfaces as the usual toast.
     */
    async function loadOlderNotifications(
      before: string,
    ): Promise<AppNotification[]> {
      try {
        const result = await loadOlderNotificationsAction(before);
        if (!result.ok) {
          notify(result.error, "error");
          return [];
        }
        setState((current) => {
          const seen = new Set(current.notifications.map((item) => item.id));
          const fresh = result.items.filter((item) => !seen.has(item.id));
          if (fresh.length === 0) return current;
          return {
            ...current,
            notifications: [...current.notifications, ...fresh],
          };
        });
        return result.items;
      } catch {
        notify("Older notifications could not be loaded. Try again.", "error");
        return [];
      }
    }

    return {
      state,
      notify,
      createTrip,
      updateTrip,
      deleteTrip,
      leaveTrip,
      copyTrip,
      addItineraryItem,
      updateItineraryItem,
      deleteItineraryItem,
      addDraftItems,
      addExpense,
      updateExpense,
      deleteExpense,
      createPoll,
      votePoll,
      addPackingItem,
      updatePackingItem,
      togglePackingItem,
      deletePackingItem,
      addNote,
      updateNote,
      deleteNote,
      respondToInvitation,
      sendInvitation,
      closePoll,
      moveItineraryItem,
      revokeInvitation,
      updateMemberRole,
      removeMember,
      setUserRole,
      submitFeedback,
      markNotificationRead,
      markNotificationUnread,
      markAllNotificationsRead,
      loadOlderNotifications,
    };
  }, [state, run, notify]);

  return (
    <DemoContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[70] flex justify-center lg:inset-x-auto lg:bottom-6 lg:right-6 lg:justify-end"
      >
        {toast && (
          <div
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border border-forest-900/15 bg-forest-900 px-4 py-3 text-paper-50 shadow-lift"
          >
            {toast.tone === "success" ? (
              <CircleCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-sage-300"
              />
            ) : toast.tone === "error" ? (
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-clay-300"
              />
            ) : (
              <Info
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-paper-200"
              />
            )}
            <p className="min-w-0 flex-1 text-[12.5px] leading-5">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="-mr-1 -mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-paper-200/70 hover:bg-paper-50/10 hover:text-paper-50"
              aria-label="Dismiss notification"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </DemoContext.Provider>
  );
}

export function useDemoStore() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemoStore must be used inside DemoProvider");
  }
  return context;
}
