import { z } from "zod";
import { getSessionUser } from "@/server/auth";
import { getBindings, getD1 } from "@/server/db";
import { getTripRole } from "@/server/permissions";
import { template } from "@/server/template";
import { TEMPLATE_TRIP_ID } from "@/lib/workspace";

/**
 * AI itinerary generation, day regeneration and activity regeneration.
 *
 * The browser never talks to an AI provider directly. Every scope handled by
 * this route follows the same rules:
 *  1. check the session,
 *  2. check that the caller may see the trip,
 *  3. validate the preferences with zod,
 *  4. call the provider with a server-only key,
 *  5. validate and normalise the answer before returning it.
 *
 * Three separate operations share this plumbing, selected by `scope`:
 *  - `trip`     — a full draft for every requested date,
 *  - `day`      — replacement content for one date only,
 *  - `activity` — one alternative for a single activity slot.
 *
 * Nothing is written to the database here. A draft only becomes itinerary
 * when a member reviews it and saves it through `addDraftItemsAction` or
 * `replaceDraftDaysAction`, which re-check permissions on their own.
 */

export const dynamic = "force-dynamic";

const ACTIVITY_CATEGORIES = [
  "Food",
  "Stay",
  "Transport",
  "Activity",
  "Sightseeing",
  "Shopping",
  "Free time",
] as const;

const CURRENCIES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "AUD",
  "CAD",
  "CHF",
  "JPY",
  "SGD",
  "THB",
  "IDR",
] as const;

const MAX_GENERATION_DAYS = 14;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "That date does not exist.",
  });

const clockTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 09:30.");

const optionalText = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).optional();

/** Shared preference fields for every generation scope. */
const preferences = {
  destination: z
    .string()
    .trim()
    .min(2, "Add a destination for the draft.")
    .max(80, "Keep the destination under 80 characters."),
  pace: z.enum(["Relaxed", "Balanced", "Packed"]),
  interests: z
    .array(z.string().trim().min(1).max(40))
    .min(1, "Choose at least one interest so the draft has a direction.")
    .max(8),
  budget: z.number().int().min(1).max(10_000_000).optional(),
  currency: z.enum(CURRENCIES).default("INR"),
  travellers: z
    .number()
    .int()
    .min(1)
    .max(99)
    .default(1),
  accommodation: optionalText(60),
  dietary: optionalText(120),
  accessibility: optionalText(120),
  transport: optionalText(60),
  include: optionalText(200),
  avoid: optionalText(200),
  constraints: optionalText(300),
};

const requestSchema = z
  .object({
    scope: z.enum(["trip", "day", "activity"]).default("trip"),
    tripId: z.string().trim().min(1).max(80),
    startDate: isoDate,
    endDate: isoDate,
    ...preferences,
    /** `scope=day`: the date being replaced. */
    date: isoDate.optional(),
    /** `scope=day`: the current activities for that date, for context. */
    currentDay: z
      .array(
        z.object({
          startTime: clockTime,
          title: z.string().trim().min(1).max(120),
        }),
      )
      .max(12)
      .optional(),
    /** `scope=activity`: the activity being replaced. */
    activity: z
      .object({
        startTime: clockTime,
        endTime: clockTime.optional(),
        title: z.string().trim().min(2).max(120),
        category: z.enum(ACTIVITY_CATEGORIES),
        location: z.string().trim().max(140),
      })
      .optional(),
    /** `scope=activity`: the other activities planned that day. */
    neighbours: z
      .array(
        z.object({
          startTime: clockTime,
          title: z.string().trim().min(1).max(120),
        }),
      )
      .max(12)
      .optional(),
  })
  .refine((value) => Date.parse(value.endDate) >= Date.parse(value.startDate), {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  })
  .refine(
    (value) => {
      const days =
        (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86_400_000 + 1;
      return days <= MAX_GENERATION_DAYS;
    },
    {
      message: `Generate at most ${MAX_GENERATION_DAYS} days at a time. Narrow the dates and generate the rest separately.`,
      path: ["endDate"],
    },
  )
  .refine(
    (value) => value.scope !== "day" || Boolean(value.date),
    { message: "Choose which day to regenerate.", path: ["date"] },
  )
  .refine(
    (value) => value.scope !== "activity" || Boolean(value.activity),
    { message: "Choose which activity to regenerate.", path: ["activity"] },
  );

const providerItem = z.object({
  date: isoDate,
  startTime: clockTime,
  endTime: clockTime.optional(),
  title: z.string().trim().min(2).max(120),
  location: z.string().trim().min(1).max(140),
  description: z.string().trim().max(600).optional(),
  estimatedCost: z.number().int().min(0).max(10_000_000).optional(),
  category: z.enum(ACTIVITY_CATEGORIES),
});

export type AiSuggestion = z.infer<typeof providerItem>;

const providerDay = z.object({
  date: isoDate,
  summary: z.string().trim().max(120),
});

/** Best-effort throttle. It is per server instance, not a billing guarantee. */
const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 6;

function withinRateLimit(userId: string, maxAttempts: number) {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter(
    (at) => now - at < WINDOW_MS,
  );
  if (recent.length >= maxAttempts) {
    attempts.set(userId, recent);
    return false;
  }
  attempts.set(userId, [...recent, now]);
  return true;
}

class AiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AiRequestError";
  }
}

function readConfig() {
  const env = getBindings();
  const rawTimeout = Number(env.AI_TIMEOUT_MS);
  const rawMax = Number(env.AI_MAX_ATTEMPTS);
  const rawBaseUrl = (env.AI_BASE_URL || "https://api.openai.com/v1").trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  // The key travels in an Authorization header, so the endpoint must be HTTPS.
  // Plain HTTP is tolerated only for a loopback address during local
  // development (a mock provider); anything else is refused rather than sent.
  const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(
    baseUrl,
  );
  const baseUrlError = !/^https:\/\//i.test(baseUrl) && !isLoopback
    ? "AI_BASE_URL must be an https:// URL (http:// is accepted only for localhost during development)."
    : null;

  return {
    apiKey: env.AI_API_KEY,
    baseUrl,
    baseUrlError,
    model: env.AI_MODEL,
    timeoutMs:
      Number.isFinite(rawTimeout) && rawTimeout >= 1000 && rawTimeout <= 120_000
        ? rawTimeout
        : 45_000,
    maxAttempts:
      Number.isFinite(rawMax) && rawMax >= 1 && rawMax <= 100
        ? Math.floor(rawMax)
        : DEFAULT_MAX_ATTEMPTS,
  };
}

function daysBetween(startDate: string, endDate: string) {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);
  let guard = 0;

  while (cursor <= last && guard < MAX_GENERATION_DAYS) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return days;
}

type TripContext = {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellers: number;
  budgetMinor: number | null;
  currency: string;
};

async function tripContext(
  userId: string,
  tripId: string,
): Promise<TripContext | null> {
  // The curated example trip is public content, so a signed-in person may plan
  // against it. It stays read-only: saving is refused by the server action.
  if (tripId === TEMPLATE_TRIP_ID) {
    return {
      name: template.name,
      destination: template.destination,
      startDate: template.startDate,
      endDate: template.endDate,
      travellers: template.members.length,
      budgetMinor: null,
      currency: "INR",
    };
  }

  const role = await getTripRole(userId, tripId);
  if (!role) return null;

  const row = await getD1()
    .prepare(
      `select name, destination, start_date, end_date, budget_minor, currency from trips where id = ?`,
    )
    .bind(tripId)
    .first<{
      name: string;
      destination: string;
      start_date: string;
      end_date: string;
      budget_minor: number | null;
      currency: string;
    }>();
  if (!row) return null;

  const members = await getD1()
    .prepare(`select count(*) as total from trip_members where trip_id = ?`)
    .bind(tripId)
    .first<{ total: number }>();

  return {
    name: row.name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    travellers: members?.total ?? 1,
    budgetMinor: row.budget_minor,
    currency: row.currency || "INR",
  };
}

type PreferencesInput = z.infer<typeof requestSchema>;

function preferenceLines(input: PreferencesInput, days: string[]) {
  const perDayBudget =
    input.budget !== undefined
      ? Math.floor(input.budget / Math.max(days.length, 1))
      : undefined;

  return [
    `Destination: ${input.destination}`,
    `Dates: ${days.join(", ")} (${days.length} days)`,
    `Travellers: ${input.travellers}`,
    `Currency for all costs: ${input.currency}`,
    `Pace: ${input.pace} — ${paceGuide[input.pace]}`,
    `Interests: ${input.interests.join(", ")}`,
    perDayBudget !== undefined
      ? `Total budget: ${input.budget} ${input.currency} for the whole trip — about ${perDayBudget} ${input.currency} per day for the group`
      : "Budget: not specified",
    input.accommodation ? `Accommodation: ${input.accommodation}` : null,
    input.dietary ? `Dietary preferences: ${input.dietary}` : null,
    input.accessibility ? `Accessibility needs: ${input.accessibility}` : null,
    input.transport ? `Getting around: ${input.transport}` : null,
    input.include ? `Must include: ${input.include}` : null,
    input.avoid ? `Must avoid: ${input.avoid}` : null,
    input.constraints ? `Additional instructions: ${input.constraints}` : null,
  ].filter((line): line is string => Boolean(line));
}

const paceGuide: Record<string, string> = {
  Relaxed:
    "two or three activities a day with real gaps for rest, and a long lunch break",
  Balanced: "three or four activities a day with meal breaks and travel time",
  Packed:
    "four or five activities a day, still ordered geographically with meal breaks",
};

const systemRules = [
  "You plan day-by-day travel itineraries for TripSync.",
  "Reply with a single JSON object and nothing else. No prose, no code fences.",
  'Shape: {"days":[{"date":"YYYY-MM-DD","summary":"short theme"}],"suggestions":[{"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","title":"...","location":"...","description":"...","estimatedCost":1200,"category":"Food"}],"budgetNote":"optional short note"}',
  "Rules:",
  "- Use only the dates listed by the user. One object per activity.",
  "- `summary` is a short theme for that day, at most 80 characters.",
  "- startTime and endTime use 24-hour HH:MM; endTime must be after startTime and reflect a realistic duration.",
  "- Order each day so travel between consecutive activities is sensible: group nearby places instead of crossing the city repeatedly.",
  "- Leave realistic time for travel between activities and include meal breaks (or a Food activity at meal time).",
  "- Never schedule the same activity or venue twice, on the same day or across days.",
  `- category must be exactly one of: ${ACTIVITY_CATEGORIES.join(", ")}.`,
  "- estimatedCost is a whole number in the requested currency, per person, when a price is genuinely typical; omit it when unknown. These are estimates, not verified prices.",
  "- description is at most two short sentences explaining why this suits the traveller's stated interests. No emoji, no links.",
  "- Never claim an attraction is open, available, bookable or discounted; you have no live data.",
  "- `location` should name a real, well-known place or area; do not invent street addresses.",
  "- If the budget per day is clearly unrealistic for this destination, still plan a good trip favouring free and low-cost options, and explain the limitation briefly in `budgetNote` with one or two practical adjustments.",
];

function scopeInstruction(scope: PreferencesInput["scope"]) {
  if (scope === "day") {
    return [
      "Plan ONLY the single date given by the user; every suggestion must use that exact date.",
      "The existing activities for that date are listed: produce a full replacement day, avoiding simple duplicates of them unless asked to keep similar ideas.",
    ].join("\n");
  }
  if (scope === "activity") {
    return [
      "Produce exactly ONE replacement activity for the described slot.",
      "Keep the same approximate time window, category and purpose, but suggest a different venue or experience.",
      "The returned object must have a `suggestions` array with exactly one item on the given date.",
    ].join("\n");
  }
  return "Plan every date listed by the user, in order.";
}

async function requestDraft(
  input: PreferencesInput,
  trip: TripContext,
  config: { apiKey: string; baseUrl: string; model: string; timeoutMs: number },
): Promise<unknown> {
  const days =
    input.scope === "day" && input.date
      ? [input.date]
      : daysBetween(input.startDate, input.endDate);

  const system = [...systemRules, scopeInstruction(input.scope)].join("\n");

  const user = [
    `Trip: ${trip.name}`,
    ...preferenceLines(input, days),
    input.scope === "day" && input.currentDay?.length
      ? `Current activities on ${input.date}: ${input.currentDay
          .map((item) => `${item.startTime} ${item.title}`)
          .join("; ")}. Replace this day with a better plan.`
      : null,
    input.scope === "activity" && input.activity
      ? `Replace this one activity: "${input.activity.title}" (${input.activity.category}) at ${input.activity.startTime}${input.activity.endTime ? `–${input.activity.endTime}` : ""}, ${input.activity.location}.`
      : null,
    input.scope === "activity" && input.neighbours?.length
      ? `Other activities that day: ${input.neighbours
          .map((item) => `${item.startTime} ${item.title}`)
          .join("; ")}. Do not repeat these.`
      : null,
    input.scope === "activity"
      ? "Return exactly one suggestion."
      : "Plan every date above, in order.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: input.scope === "activity" ? 0.9 : 0.7,
        max_tokens:
          input.scope === "activity" ? 500 : input.scope === "day" ? 1600 : 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AiRequestError(
        504,
        "The AI provider took too long to answer. Nothing was saved; please try again.",
      );
    }
    // The name and message only: a provider URL can carry a key in its query
    // string, so it is never logged.
    console.error(
      "[tripsync] AI provider fetch failed:",
      error instanceof Error ? `${error.name}` : "unknown error",
    );
    throw new AiRequestError(
      502,
      "The AI provider could not be reached. Please try again in a moment.",
    );
  }

  if (!response.ok) {
    // Log the status only: provider error bodies can echo the prompt.
    console.error("[tripsync] AI provider rejected the request:", response.status);
    if (response.status === 429) {
      throw new AiRequestError(
        429,
        "The AI provider is rate limiting requests right now. Try again shortly.",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new AiRequestError(
        503,
        "The AI provider rejected the server key. Check AI_API_KEY before trying again.",
      );
    }
    if (response.status === 404) {
      // Providers answer 404 for a model id that no longer exists. Gemini
      // retires model ids on a schedule, so this is the most likely cause
      // after a deployment has been running for a while.
      throw new AiRequestError(
        503,
        "The AI provider does not know that model. Check AI_MODEL (retired model ids fail here) and AI_BASE_URL, then try again.",
      );
    }
    if (response.status === 400) {
      // The provider refused our payload shape; the request itself is at fault.
      throw new AiRequestError(
        502,
        "The AI provider did not accept the request. Check AI_MODEL and AI_BASE_URL, then try again.",
      );
    }
    throw new AiRequestError(
      502,
      "The AI provider returned an error. Nothing was saved; please try again.",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { choices?: { message?: { content?: unknown } }[] }
    | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AiRequestError(
      502,
      "The AI provider returned an empty answer. Please try again.",
    );
  }

  // Some providers wrap JSON in a fenced block even when asked not to.
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiRequestError(
      502,
      "The AI provider returned something that was not valid JSON. Please try again.",
    );
  }
}

/** Keeps only usable suggestions and fixes small, unambiguous problems. */
function normalize(
  raw: unknown,
  days: string[],
  pace: PreferencesInput["pace"],
  scope: PreferencesInput["scope"],
) {
  const container = raw as { suggestions?: unknown; days?: unknown; budgetNote?: unknown } | null;
  const list = Array.isArray(container?.suggestions)
    ? container.suggestions
    : Array.isArray(raw)
      ? raw
      : [];

  const perDayCap = pace === "Packed" ? 7 : pace === "Relaxed" ? 3 : 5;
  const perDay = new Map<string, number>();
  const accepted: AiSuggestion[] = [];
  // The same venue at the same time on the same day is one activity, not two.
  const seen = new Set<string>();
  let dropped = 0;

  for (const entry of list) {
    const parsed = providerItem.safeParse(entry);
    if (!parsed.success) {
      dropped += 1;
      continue;
    }
    const item = parsed.data;
    if (!days.includes(item.date)) {
      dropped += 1;
      continue;
    }
    const used = perDay.get(item.date) ?? 0;
    if (used >= perDayCap) {
      dropped += 1;
      continue;
    }
    if (item.endTime && item.endTime <= item.startTime) {
      dropped += 1;
      continue;
    }
    const fingerprint = `${item.date}|${item.startTime}|${item.title.toLowerCase()}`;
    if (seen.has(fingerprint)) {
      dropped += 1;
      continue;
    }
    seen.add(fingerprint);
    perDay.set(item.date, used + 1);
    accepted.push({
      ...item,
      title: item.title.replace(/\s+/g, " ").slice(0, 120),
      location: item.location.replace(/\s+/g, " ").slice(0, 140),
      description: item.description?.replace(/\s+/g, " ").slice(0, 600),
    });
  }

  accepted.sort((left, right) =>
    left.date === right.date
      ? left.startTime.localeCompare(right.startTime)
      : left.date.localeCompare(right.date),
  );

  // Day summaries and the budget note are display-only extras; malformed
  // values are dropped rather than failing the whole answer.
  const daySummaries = new Map<string, string>();
  if (Array.isArray(container?.days)) {
    for (const entry of container.days) {
      const parsed = providerDay.safeParse(entry);
      if (
        parsed.success &&
        days.includes(parsed.data.date) &&
        !daySummaries.has(parsed.data.date)
      ) {
        daySummaries.set(
          parsed.data.date,
          parsed.data.summary.replace(/\s+/g, " ").slice(0, 120),
        );
      }
    }
  }

  const budgetNote =
    typeof container?.budgetNote === "string" && container.budgetNote.trim()
      ? container.budgetNote.replace(/\s+/g, " ").slice(0, 400)
      : undefined;

  if (scope === "activity") {
    return {
      suggestions: accepted.slice(0, 1),
      dropped: dropped + Math.max(accepted.length - 1, 0),
      daySummaries: [],
      budgetNote,
    };
  }

  return {
    suggestions: accepted,
    dropped,
    daySummaries: [...daySummaries.entries()].map(([date, summary]) => ({
      date,
      summary,
    })),
    budgetNote,
  };
}

export async function GET() {
  const config = readConfig();
  return Response.json({
    configured: Boolean(config.apiKey && config.model && !config.baseUrlError),
    model: config.model ?? null,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { error: "Sign in to generate an itinerary draft." },
      { status: 401 },
    );
  }

  // Preference fields are all short; a body larger than this is not a real
  // request and does not deserve a provider call or a parse attempt.
  const rawBody = await request.text();
  if (rawBody.length > 16_384) {
    return Response.json(
      { error: "That request is too large. Shorten the preferences and try again." },
      { status: 413 },
    );
  }
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const trip = await tripContext(user.id, input.tripId);
  if (!trip) {
    // Deliberately identical for "missing" and "not yours": this must not
    // reveal whether somebody else's trip exists.
    return Response.json(
      { error: "That trip is not available to your account." },
      { status: 404 },
    );
  }

  // Every requested date must fall inside the trip itself; the database
  // actions enforce the same rule again at save time.
  if (input.startDate < trip.startDate || input.endDate > trip.endDate) {
    return Response.json(
      {
        error: `The draft dates must fall inside the trip (${trip.startDate} to ${trip.endDate}).`,
      },
      { status: 400 },
    );
  }
  if (input.scope === "day" && input.date) {
    if (input.date < trip.startDate || input.date > trip.endDate) {
      return Response.json(
        { error: "That day is outside the trip dates." },
        { status: 400 },
      );
    }
  }
  if (
    input.scope === "activity" &&
    (input.startDate !== input.endDate || input.startDate < trip.startDate)
  ) {
    return Response.json(
      { error: "Pick a single day inside the trip to replace an activity." },
      { status: 400 },
    );
  }

  const config = readConfig();
  if (config.baseUrlError) {
    console.error("[tripsync] AI configuration rejected:", config.baseUrlError);
    return Response.json(
      {
        error: `AI generation is misconfigured on this server. ${config.baseUrlError}`,
      },
      { status: 503 },
    );
  }
  const provider =
    config.apiKey && config.model
      ? {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          timeoutMs: config.timeoutMs,
        }
      : null;
  if (!provider) {
    return Response.json(
      {
        error:
          "AI generation is not configured on this server. Add AI_API_KEY and AI_MODEL as server secrets, then try again.",
      },
      { status: 503 },
    );
  }

  if (!withinRateLimit(user.id, config.maxAttempts)) {
    return Response.json(
      {
        error:
          "You have generated several drafts recently. Wait a few minutes before trying again.",
      },
      { status: 429 },
    );
  }

  try {
    const raw = await requestDraft(input, trip, provider);
    const scopeDays =
      input.scope === "day" && input.date
        ? [input.date]
        : daysBetween(input.startDate, input.endDate);
    const { suggestions, dropped, daySummaries, budgetNote } = normalize(
      raw,
      scopeDays,
      input.pace,
      input.scope,
    );

    const minimum = input.scope === "activity" ? 1 : 1;
    if (suggestions.length < minimum) {
      return Response.json(
        {
          error:
            "The model answered, but no usable suggestions survived validation. Try again or adjust the preferences.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      suggestions,
      days: daySummaries,
      budgetNote,
      model: config.model,
      dropped,
      count: suggestions.length,
      scope: input.scope,
    });
  } catch (error) {
    if (error instanceof AiRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(
      "[tripsync] AI generation failed:",
      error instanceof Error ? error.name : "unknown error",
    );
    return Response.json(
      { error: "The draft could not be generated. Nothing was saved." },
      { status: 500 },
    );
  }
}
