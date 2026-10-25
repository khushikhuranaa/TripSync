import { z } from "zod";

/**
 * Server-side validation.
 *
 * The same rules apply no matter where a request comes from, because every
 * server action validates its own input. The browser also validates for quick
 * feedback, but it is never the security boundary.
 */

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "That date does not exist.",
  });

const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 09:30.");

const optionalMoney = z
  .string()
  .trim()
  .max(12)
  .refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Enter a whole amount, or use up to two decimal places.",
  });

const optionalLink = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), {
    message: "Links must start with http:// or https://.",
  })
  .default("");

const activityCategory = z.enum([
  "Food",
  "Stay",
  "Transport",
  "Activity",
  "Sightseeing",
  "Shopping",
  "Free time",
]);

const expenseCategory = z.enum([
  "Stay",
  "Food",
  "Transport",
  "Activities",
  "Shopping",
  "Other",
]);

const packingCategory = z.enum([
  "Essentials",
  "Clothing",
  "Gear",
  "Health",
  "Documents",
]);

const travelStyle = z.enum(["Relaxed", "Balanced", "Packed"]);
const tripAccessRole = z.enum(["editor", "viewer"]);

export const coverImages = [
  "/images/goa-palolem.jpg",
  "/images/jaipur-hawa-mahal.jpg",
  "/images/kerala-houseboat.jpg",
  "/images/coorg-hills.jpg",
  "/images/manali-mountains.jpg",
] as const;

export const tripSchema = z
  .object({
    name: z.string().trim().min(2, "Give the trip a name of at least 2 characters.").max(80),
    destination: z
      .string()
      .trim()
      .min(2, "Add the destination so members know where you are going.")
      .max(80),
    startDate: isoDate,
    endDate: isoDate,
    budget: optionalMoney,
    travellers: z
      .string()
      .trim()
      .regex(/^\d{1,2}$/, "Travellers must be a whole number.")
      .refine((value) => Number(value) >= 1 && Number(value) <= 99, {
        message: "Enter between 1 and 99 travellers.",
      }),
    description: z.string().trim().max(600, "Keep the description under 600 characters."),
    coverImage: z.string().trim().max(200),
  })
  .refine((value) => Date.parse(value.endDate) >= Date.parse(value.startDate), {
    message: "The return date cannot be before the departure date.",
    path: ["endDate"],
  });

export const activitySchema = z
  .object({
    title: z.string().trim().min(2, "Add an activity name.").max(120),
    date: isoDate,
    startTime: time,
    endTime: z.union([time, z.literal("")]),
    location: z.string().trim().max(140),
    address: z.string().trim().max(200).default(""),
    mapUrl: optionalLink,
    referenceUrl: optionalLink,
    estimatedCost: optionalMoney,
    description: z.string().trim().max(600),
    category: activityCategory,
  })
  .refine((value) => !value.endTime || value.endTime > value.startTime, {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

export const expenseSchema = z.object({
  description: z.string().trim().min(2, "Describe what the expense was for.").max(120),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount greater than zero.")
    .refine((value) => Number(value) > 0, "Enter an amount greater than zero."),
  category: expenseCategory,
  date: isoDate,
  notes: z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
  payerId: z.string().trim().min(1, "Choose who paid."),
  participantIds: z
    .array(z.string().trim().min(1))
    .min(1, "Choose at least one person to share the expense.")
    .max(50),
  /**
   * Optional unequal split: rupees owed per participant. When absent the
   * expense is split equally across `participantIds`.
   */
  shares: z
    .record(z.string().trim().min(1), z.number().finite().min(0).max(10_000_000))
    .optional(),
});

export const pollSchema = z.object({
  question: z.string().trim().min(4, "Ask a clear question.").max(160),
  description: z
    .string()
    .trim()
    .max(400, "Keep the context under 400 characters.")
    .optional(),
  options: z
    .array(z.string().trim().min(1, "Options cannot be blank.").max(80))
    .min(2, "Add at least two options.")
    .max(6, "Keep polls to six options or fewer."),
  closesAt: z.union([isoDate, z.literal("")]),
});

export const voteSchema = z.object({
  pollId: z.string().trim().min(1),
  optionId: z.string().trim().min(1),
});

export const packingSchema = z.object({
  name: z.string().trim().min(2, "Name the item.").max(80),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+$/, "Quantity must be a whole number.")
    .refine((value) => Number(value) >= 1 && Number(value) <= 99, {
      message: "Quantity must be between 1 and 99.",
    }),
  notes: z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
  category: packingCategory,
  assignedTo: z.string().trim().max(64),
});

export const noteCategory = z.enum([
  "General",
  "Bookings",
  "Transport",
  "Food",
  "Contacts",
  "Other",
]);

export const noteSchema = z.object({
  title: z.string().trim().min(2, "Give the note a title.").max(120),
  body: z.string().trim().min(1, "Write the note before saving.").max(4000),
  category: noteCategory.optional(),
});

/**
 * Editing a note is an optimistic-concurrency write: the client sends the
 * `updatedAt` it last saw, and the action refuses if someone else saved first.
 */
export const noteUpdateSchema = noteSchema.extend({
  expectedUpdatedAt: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "The note version is missing. Reload and try again.",
    }),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  homeCity: z.string().trim().max(80),
  travelStyle,
  dietaryNotes: z.string().trim().max(400),
});

export const notificationPreferencesSchema = z.object({
  invitations: z.boolean(),
  tripUpdates: z.boolean(),
  polls: z.boolean(),
  budget: z.boolean(),
});

export const notificationIdSchema = z.string().trim().min(1).max(64);

export const memberRoleSchema = z.object({
  tripId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  role: tripAccessRole,
});

export const memberRemoveSchema = z.object({
  tripId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

export const feedbackSchema = z.object({
  rating: z
    .number()
    .int("Choose a whole star rating.")
    .min(1, "Choose a rating from 1 to 5.")
    .max(5, "Choose a rating from 1 to 5."),
  comment: z.string().trim().max(600, "Keep feedback under 600 characters."),
});

export const invitationSchema = z.object({
  tripId: z.string().trim().min(1),
  name: z.string().trim().max(80),
  email: z.email("Enter a valid email address.").max(160),
  role: tripAccessRole.default("editor"),
});

export const copyTemplateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
});

export const roleSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(["user", "admin"]),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(8, "Enter your current password.").max(128),
  newPassword: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use 128 characters or fewer."),
});

export const accountDeleteSchema = z.object({
  confirmEmail: z.email("Type your email address to confirm."),
});

export type TripInput = z.infer<typeof tripSchema>;
export type ActivityInput = z.infer<typeof activitySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type PollInput = z.infer<typeof pollSchema>;
export type PackingInput = z.infer<typeof packingSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;

/** The first useful message from a Zod error, never the raw object. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That input is not valid.";
}
