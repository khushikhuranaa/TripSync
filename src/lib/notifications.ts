import type { NotificationPreferences, NotificationType } from "@/lib/types";

export const defaultNotificationPreferences: NotificationPreferences = {
  invitations: true,
  tripUpdates: true,
  polls: true,
  budget: true,
};

/** Which switch governs each in-app notification type. */
export const notificationPreferenceFor: Record<
  NotificationType,
  keyof NotificationPreferences
> = {
  invitation: "invitations",
  membership: "tripUpdates",
  itinerary: "tripUpdates",
  poll: "polls",
  budget: "budget",
};

/**
 * Read the stored JSON. Anything missing or malformed falls back to "on", so a
 * bad value can never silence a user's notifications by accident.
 */
export function parseNotificationPreferences(
  value: string | null | undefined,
): NotificationPreferences {
  if (!value) return defaultNotificationPreferences;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return defaultNotificationPreferences;
    }
    const record = parsed as Record<string, unknown>;
    return {
      invitations: record.invitations !== false,
      tripUpdates: record.tripUpdates !== false,
      polls: record.polls !== false,
      budget: record.budget !== false,
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

export function serializeNotificationPreferences(
  preferences: NotificationPreferences,
): string {
  return JSON.stringify(preferences);
}
