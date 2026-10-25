"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Info,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ActivityIcon, activityLabel } from "@/components/itinerary/activity-meta";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { addDraftItemsAction, replaceDraftDaysAction } from "@/server/actions";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/cn";
import {
  eachDay,
  formatCurrency,
  formatDateRange,
  formatDayLabel,
  formatTimeRange,
} from "@/lib/format";
import type { ActivityCategory, ItineraryItem, Trip } from "@/lib/types";

/**
 * The AI trip planner.
 *
 * Generation happens on TripSync's server (`/api/ai/itinerary`), which holds
 * the provider key. This component collects the planning preferences, shows
 * what came back, lets every suggestion be edited, reordered, regenerated or
 * removed, and saves only what the user approves — through the same server
 * actions that guard every other itinerary change. Nothing is written to
 * browser storage; the unsaved draft lives in React state only.
 */

const interestOptions = [
  "Food",
  "Culture",
  "History",
  "Nature",
  "Art",
  "Beaches",
  "Shopping",
  "Nightlife",
  "Adventure",
  "Relaxation",
  "Photography",
  "Slow travel",
];

const paces = ["Relaxed", "Balanced", "Packed"] as const;

const currencyOptions = [
  "INR", "USD", "EUR", "GBP", "AED", "AUD",
  "CAD", "CHF", "JPY", "SGD", "THB", "IDR",
] as const;

const accommodationOptions = [
  "Any", "Hotel", "Hostel", "Guesthouse", "Homestay", "Vacation rental", "Camping",
] as const;

const transportOptions = [
  "Any", "Mostly on foot", "Public transport", "Rental car", "Taxi and rideshare", "Mixed",
] as const;

const categoryOptions: ActivityCategory[] = [
  "Food", "Stay", "Transport", "Activity", "Sightseeing", "Shopping", "Free time",
];

const AI_NOTE =
  "AI suggestion — estimated, not verified. Confirm opening hours, prices and availability before relying on it.";

interface DraftItem {
  id: string;
  title: string;
  time: string;
  endTime?: string;
  location: string;
  cost?: number;
  description?: string;
  category: ActivityCategory;
  verificationNote?: string;
  included: boolean;
}

interface DraftDay {
  date: string;
  summary?: string;
  items: DraftItem[];
}

interface AiSuggestion {
  date: string;
  startTime: string;
  endTime?: string;
  title: string;
  location: string;
  description?: string;
  estimatedCost?: number;
  category: ActivityCategory;
}

interface AiResponse {
  suggestions?: AiSuggestion[];
  days?: { date: string; summary: string }[];
  budgetNote?: string;
  model?: string;
  error?: string;
}

interface AiStatus {
  configured: boolean;
  model?: string;
}

/** Builds a plain Google Maps search link. No API key or place id is claimed. */
function mapsUrlFor(location: string, destination: string) {
  const query = [location, destination].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Splits a day's suggestions into Morning / Afternoon / Evening sections for
 * the review list. Times are validated 24-hour `HH:MM` strings, so a plain
 * string comparison is safe. Empty buckets are omitted.
 */
function bucketByTimeOfDay(items: DraftItem[]) {
  const buckets = [
    { label: "Morning", match: (time: string) => time < "12:00" },
    {
      label: "Afternoon",
      match: (time: string) => time >= "12:00" && time < "18:00",
    },
    { label: "Evening", match: (time: string) => time >= "18:00" },
  ];
  return buckets
    .map((bucket) => ({
      label: bucket.label,
      entries: items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => bucket.match(item.time)),
    }))
    .filter((bucket) => bucket.entries.length > 0);
}

function suggestionsToDays(
  suggestions: AiSuggestion[],
  daySummaries?: { date: string; summary: string }[],
): DraftDay[] {
  const summaries = new Map(
    (daySummaries ?? []).map((entry) => [entry.date, entry.summary]),
  );
  const grouped = new Map<string, DraftItem[]>();
  for (const item of suggestions) {
    const list = grouped.get(item.date) ?? [];
    list.push({
      id: `draft-${item.date}-${list.length}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      time: item.startTime,
      endTime: item.endTime,
      location: item.location,
      cost: item.estimatedCost,
      description: item.description,
      category: item.category,
      verificationNote: AI_NOTE,
      included: true,
    });
    grouped.set(item.date, list);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, items]) => ({
      date,
      summary: summaries.get(date),
      items: items.sort((left, right) => left.time.localeCompare(right.time)),
    }));
}

/* ----------------------------------------------------------------- dialogs */

function DraftItemDialog({
  title,
  item,
  siblings = [],
  onSave,
  onClose,
}: {
  title: string;
  item: DraftItem;
  /** Other suggestions already drafted for the same day. */
  siblings?: DraftItem[];
  onSave: (next: DraftItem) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    name: item.title,
    time: item.time,
    endTime: item.endTime ?? "",
    location: item.location,
    cost: item.cost === undefined ? "" : String(item.cost),
    description: item.description ?? "",
    category: item.category,
  });
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("Give the activity a name.");
      return;
    }
    if (!values.time) {
      setError("Add a start time for the activity.");
      return;
    }
    if (values.endTime && values.endTime <= values.time) {
      setError("The end time must be after the start time.");
      return;
    }
    if (!values.location.trim()) {
      setError("Add a place or area.");
      return;
    }
    const duplicate = siblings.some(
      (entry) =>
        entry.title.trim().toLowerCase() === values.name.trim().toLowerCase(),
    );
    if (duplicate) {
      setError(
        "This day already has an activity with that name. Rename this one or edit the existing activity.",
      );
      return;
    }
    const cost = values.cost.trim() ? Number(values.cost) : undefined;
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      setError("Use a positive cost, or leave it empty.");
      return;
    }
    onSave({
      ...item,
      title: values.name.trim(),
      time: values.time,
      endTime: values.endTime || undefined,
      location: values.location.trim(),
      cost: cost === undefined ? undefined : Math.round(cost),
      description: values.description.trim() || undefined,
      category: values.category,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This changes the draft only. Nothing is added to the trip until you
            save the approved activities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          <Field id="draft-title" label="Activity">
            <Input
              id="draft-title"
              autoFocus
              value={values.name}
              onChange={(event) =>
                setValues((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="draft-time" label="Starts">
              <Input
                id="draft-time"
                type="time"
                value={values.time}
                onChange={(event) =>
                  setValues((current) => ({ ...current, time: event.target.value }))
                }
              />
            </Field>
            <Field id="draft-end-time" label="Ends" optional>
              <Input
                id="draft-end-time"
                type="time"
                value={values.endTime}
                onChange={(event) =>
                  setValues((current) => ({ ...current, endTime: event.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="draft-category" label="Category">
              <select
                id="draft-category"
                value={values.category}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    category: event.target.value as ActivityCategory,
                  }))
                }
                className="h-9 w-full rounded-lg border border-line-strong bg-card px-2.5 text-[12.5px] text-ink-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {activityLabel(category)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="draft-cost" label="Est. cost" optional hint="per person">
              <Input
                id="draft-cost"
                type="number"
                min={0}
                step={1}
                value={values.cost}
                onChange={(event) =>
                  setValues((current) => ({ ...current, cost: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field id="draft-location" label="Place or area">
            <Input
              id="draft-location"
              value={values.location}
              onChange={(event) =>
                setValues((current) => ({ ...current, location: event.target.value }))
              }
            />
          </Field>
          <Field id="draft-notes" label="Notes" optional>
            <Textarea
              id="draft-notes"
              className="min-h-20"
              value={values.description}
              onChange={(event) =>
                setValues((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>

          {error && (
            <p role="alert" className="text-[12px] font-medium text-clay-700">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save to draft</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shows a regenerated day or activity before the user accepts or keeps it. */
function RegenerationPreviewDialog({
  type,
  date,
  currency,
  current,
  currentItems,
  replacement,
  onAccept,
  onClose,
}: {
  type: "day" | "activity";
  date: string;
  currency: string;
  /** For `activity`: the single item being compared. */
  current?: DraftItem;
  /** For `day`: the activities currently drafted for that date. */
  currentItems?: DraftItem[];
  replacement: DraftItem[];
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {type === "day"
              ? `Replacement for ${formatDayLabel(date)}`
              : "Alternative activity"}
          </DialogTitle>
          <DialogDescription>
            {type === "day"
              ? "Accepting swaps every suggestion for this day. Other days are untouched."
              : "Accepting replaces only this activity; the rest of the day is untouched."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {type === "activity" && current && (
            <div className="rounded-lg border border-line bg-paper-100/50 px-3 py-3">
              <p className="eyebrow">Current draft</p>
              <p className="mt-1 text-[13px] font-semibold text-forest-900">
                {current.title}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-500">
                {formatTimeRange(current.time, current.endTime)} ·{" "}
                {activityLabel(current.category)} · {current.location}
              </p>
            </div>
          )}
          {type === "day" && (
            <div className="rounded-lg border border-line bg-paper-100/50 px-3 py-3">
              <p className="eyebrow">Currently drafted for this day</p>
              <p className="mt-1 text-[11.5px] text-ink-500">
                {currentItems && currentItems.length > 0
                  ? currentItems
                      .map(
                        (item) =>
                          `${formatTimeRange(item.time, item.endTime)} ${item.title}`,
                      )
                      .join(" · ")
                  : "Nothing — accepting will fill this day."}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-forest-800/30 bg-card px-3 py-3">
            <p className="eyebrow text-forest-800">Proposed replacement</p>
            <ul className="mt-2 space-y-2.5">
              {replacement.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <ActivityIcon category={item.category} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold leading-5 text-forest-900">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {formatTimeRange(item.time, item.endTime)} ·{" "}
                      {activityLabel(item.category)} · {item.location}
                      {item.cost !== undefined && item.cost > 0
                        ? ` · ≈ ${formatCurrency(item.cost, currency)}`
                        : ""}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-[11.5px] leading-5 text-ink-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Keep original
          </Button>
          <Button onClick={onAccept}>Use replacement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------- the planner */

export function AiPlanner({
  trip,
  defaultStyle,
}: {
  trip: Trip;
  defaultStyle: "Relaxed" | "Balanced" | "Packed";
}) {
  const router = useRouter();
  const { state } = useDemoStore();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travellers: String(trip.travellerCount ?? trip.members.length ?? 1),
    budget: trip.budget ? String(trip.budget) : "",
    currency: ((currencyOptions as readonly string[]).includes(trip.currency)
      ? trip.currency
      : "INR") as string,
    pace: defaultStyle,
    accommodation: "Any",
    dietary: "",
    accessibility: "",
    transport: "Any",
    include: "",
    avoid: "",
    constraints: "",
  });
  const [interests, setInterests] = useState<string[]>(["Food", "Nature"]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [draft, setDraft] = useState<DraftDay[]>([]);
  const [baseline, setBaseline] = useState<DraftDay[]>([]);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | undefined>();
  const [budgetNote, setBudgetNote] = useState<string | undefined>();
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ date: string; item: DraftItem } | null>(
    null,
  );
  /** Busy key for regeneration: `day:<date>` or `item:<id>`. */
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenPreview, setRegenPreview] = useState<{
    type: "day" | "activity";
    date: string;
    currency: string;
    current?: DraftItem;
    currentItems?: DraftItem[];
    replacement: DraftItem[];
    apply: (replacement: DraftItem[]) => void;
  } | null>(null);
  /** Set when the trip already has saved activities on the draft's days. */
  const [saveChoice, setSaveChoice] = useState<{
    dates: string[];
    existingCount: number;
  } | null>(null);

  // The draft lives only in this component. A reload or a closed tab would lose
  // reviewed edits silently, so the browser is asked to confirm first.
  const draftSignature = JSON.stringify(draft);
  const baselineSignature = JSON.stringify(baseline);
  useEffect(() => {
    if (!generated || draftSignature === baselineSignature || saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [generated, draftSignature, baselineSignature, saving]);

  function update<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key as string]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
    if (errors.interests) {
      setErrors((current) => ({ ...current, interests: undefined }));
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/itinerary")
      .then((response) =>
        response.ok ? (response.json() as Promise<AiStatus>) : null,
      )
      .then((payload) => {
        if (!cancelled && payload) setAiStatus(payload);
      })
      .catch(() => {
        if (!cancelled) setAiStatus({ configured: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function validate(): boolean {
    const next: Record<string, string | undefined> = {};
    const destination = values.destination.trim();

    if (!destination) next.destination = "Add a destination for the draft.";
    else if (destination.length < 2)
      next.destination = "Use at least 2 characters.";
    else if (destination.length > 80)
      next.destination = "Keep the destination under 80 characters.";

    const start = values.startDate;
    const end = values.endDate;
    if (!start) next.startDate = "Choose a start date.";
    if (!end) next.endDate = "Choose an end date.";
    if (start && end) {
      if (Number.isNaN(Date.parse(`${start}T00:00:00Z`)))
        next.startDate = "That date does not exist.";
      if (Number.isNaN(Date.parse(`${end}T00:00:00Z`)))
        next.endDate = "That date does not exist.";
      if (!next.startDate && !next.endDate) {
        if (end < start)
          next.endDate = "The end date cannot be before the start date.";
        else if (eachDay(start, end).length > 14)
          next.endDate =
            "Generate at most 14 days at a time. Narrow the dates and generate the rest separately.";
        else if (start < trip.startDate || end > trip.endDate)
          next.startDate = `Dates must fall inside the trip (${formatDateRange(trip.startDate, trip.endDate)}).`;
      }
    }

    const travellers = values.travellers.trim();
    if (!/^\d{1,2}$/.test(travellers) || Number(travellers) < 1)
      next.travellers = "Enter a whole number of travellers between 1 and 99.";

    if (values.budget.trim()) {
      const budget = Number(values.budget);
      if (!Number.isFinite(budget) || budget <= 0)
        next.budget = "Use a positive amount, or leave it empty.";
      else if (!Number.isInteger(budget))
        next.budget = "Use whole amounts with no decimals.";
      else if (budget > 10_000_000)
        next.budget = "That budget is larger than this app supports.";
    }

    if (interests.length === 0)
      next.interests =
        "Choose at least one interest so the draft has a direction.";
    if (values.dietary.length > 120)
      next.dietary = "Keep this under 120 characters.";
    if (values.accessibility.length > 120)
      next.accessibility = "Keep this under 120 characters.";
    if (values.include.length > 200)
      next.include = "Keep this under 200 characters.";
    if (values.avoid.length > 200)
      next.avoid = "Keep this under 200 characters.";
    if (values.constraints.length > 300)
      next.constraints = "Keep instructions under 300 characters.";

    setErrors(next);
    return Object.values(next).every((value) => !value);
  }

  function requestBody(scope: "trip" | "day" | "activity") {
    return {
      scope,
      tripId: trip.id,
      destination: values.destination.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
      pace: values.pace,
      interests,
      budget: values.budget.trim() ? Number(values.budget) : undefined,
      currency: values.currency,
      travellers: Number(values.travellers.trim() || "1"),
      accommodation:
        values.accommodation === "Any" ? undefined : values.accommodation,
      dietary: values.dietary.trim() || undefined,
      accessibility: values.accessibility.trim() || undefined,
      transport: values.transport === "Any" ? undefined : values.transport,
      include: values.include.trim() || undefined,
      avoid: values.avoid.trim() || undefined,
      constraints: values.constraints.trim() || undefined,
    };
  }

  async function callProvider(body: Record<string, unknown>): Promise<AiResponse> {
    const response = await fetch("/api/ai/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as AiResponse | null;
    if (!response.ok || !payload) {
      return {
        error:
          payload?.error ??
          "The AI provider did not return a usable answer. Please try again.",
      };
    }
    if (payload.model) setAiStatus({ configured: true, model: payload.model });
    return payload;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generating) return;
    if (!validate()) return;

    setGenerating(true);
    setGenerationError(undefined);
    try {
      const payload = await callProvider(requestBody("trip"));
      if (payload.error || !payload.suggestions?.length) {
        // The form keeps everything the user typed; only the draft area resets.
        setGenerationError(
          payload.error ??
            "The AI provider did not return a usable draft. Please try again.",
        );
        return;
      }
      const nextDraft = suggestionsToDays(payload.suggestions, payload.days);
      setDraft(nextDraft);
      setBaseline(nextDraft);
      setCollapsed(new Set());
      setBudgetNote(payload.budgetNote);
      setGenerated(true);
    } catch {
      setGenerationError(
        "The request could not reach the server. Check your connection and try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  /* ------------------------------------------------------ draft mutations */

  function toggleItem(dayDate: string, itemId: string) {
    setDraft((current) =>
      current.map((day) =>
        day.date !== dayDate
          ? day
          : {
              ...day,
              items: day.items.map((item) =>
                item.id === itemId ? { ...item, included: !item.included } : item,
              ),
            },
      ),
    );
  }

  function removeItem(dayDate: string, itemId: string) {
    setDraft((current) =>
      current.map((day) =>
        day.date !== dayDate
          ? day
          : { ...day, items: day.items.filter((item) => item.id !== itemId) },
      ),
    );
  }

  function moveItem(dayDate: string, itemId: string, direction: -1 | 1) {
    // Moving an activity also swaps its time slot with the neighbour, so the
    // saved itinerary keeps the order the user actually sees.
    setDraft((current) =>
      current.map((day) => {
        if (day.date !== dayDate) return day;
        const index = day.items.findIndex((item) => item.id === itemId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= day.items.length) return day;
        const items = [...day.items];
        const [moved] = items.splice(index, 1);
        items.splice(target, 0, moved);
        // Whichever direction we moved, the displaced neighbour ends up at the
        // original index — that is the item whose time slot must be swapped,
        // so the list stays chronological after the move.
        const other = items[index];
        return {
          ...day,
          items: items.map((item) => {
            if (item.id === moved.id)
              return { ...item, time: other.time, endTime: other.endTime };
            if (item.id === other.id)
              return { ...item, time: moved.time, endTime: moved.endTime };
            return item;
          }),
        };
      }),
    );
  }

  function saveItem(dayDate: string, next: DraftItem) {
    setDraft((current) =>
      current.map((day) =>
        day.date !== dayDate
          ? day
          : {
              ...day,
              items: day.items.some((item) => item.id === next.id)
                ? day.items.map((item) => (item.id === next.id ? next : item))
                : [...day.items, next],
            },
      ),
    );
  }

  function toggleDay(date: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  /* ---------------------------------------------------- regeneration */

  async function regenerateDay(day: DraftDay) {
    if (regenerating) return;
    setRegenerating(`day:${day.date}`);
    setGenerationError(undefined);
    try {
      const payload = await callProvider({
        ...requestBody("day"),
        startDate: day.date,
        endDate: day.date,
        date: day.date,
        currentDay: day.items.map((item) => ({
          startTime: item.time,
          title: item.title,
        })),
      });
      if (payload.error || !payload.suggestions?.length) {
        setGenerationError(
          payload.error ?? "The provider returned no replacement for that day.",
        );
        return;
      }
      const replacement = suggestionsToDays(payload.suggestions, payload.days)[0];
      if (!replacement) {
        setGenerationError("The provider returned no replacement for that day.");
        return;
      }
      setRegenPreview({
        type: "day",
        date: day.date,
        currency: values.currency,
        currentItems: day.items,
        replacement: replacement.items,
        apply: (items) => {
          setDraft((current) =>
            current.map((entry) =>
              entry.date !== day.date
                ? entry
                : {
                    ...entry,
                    summary: replacement.summary ?? entry.summary,
                    items,
                  },
            ),
          );
        },
      });
    } catch {
      setGenerationError(
        "The regeneration request could not reach the server. Your original draft is unchanged.",
      );
    } finally {
      setRegenerating(null);
    }
  }

  async function regenerateItem(day: DraftDay, item: DraftItem) {
    if (regenerating) return;
    setRegenerating(`item:${item.id}`);
    setGenerationError(undefined);
    try {
      const payload = await callProvider({
        ...requestBody("activity"),
        startDate: day.date,
        endDate: day.date,
        activity: {
          startTime: item.time,
          endTime: item.endTime,
          title: item.title,
          category: item.category,
          location: item.location,
        },
        neighbours: day.items
          .filter((entry) => entry.id !== item.id)
          .map((entry) => ({ startTime: entry.time, title: entry.title })),
      });
      if (payload.error || !payload.suggestions?.length) {
        setGenerationError(
          payload.error ??
            "The provider returned no alternative for that activity.",
        );
        return;
      }
      const [suggestion] = payload.suggestions;
      const alternative: DraftItem = {
        id: item.id,
        title: suggestion.title,
        time: suggestion.startTime,
        endTime: suggestion.endTime,
        location: suggestion.location,
        cost: suggestion.estimatedCost,
        description: suggestion.description,
        category: suggestion.category,
        verificationNote: AI_NOTE,
        included: item.included,
      };
      setRegenPreview({
        type: "activity",
        date: day.date,
        currency: values.currency,
        current: item,
        replacement: [alternative],
        apply: (items) => {
          setDraft((current) =>
            current.map((entry) =>
              entry.date !== day.date
                ? entry
                : {
                    ...entry,
                    items: entry.items
                      .map((existing) =>
                        existing.id === item.id ? items[0] : existing,
                      )
                      .sort((left, right) => left.time.localeCompare(right.time)),
                  },
            ),
          );
        },
      });
    } catch {
      setGenerationError(
        "The regeneration request could not reach the server. Your original draft is unchanged.",
      );
    } finally {
      setRegenerating(null);
    }
  }

  /* ----------------------------------------------------------- saving */

  const approvedItems = useMemo(
    () =>
      draft.flatMap((day) =>
        day.items
          .filter((item) => item.included)
          .map((item) => ({
            date: day.date,
            startTime: item.time,
            endTime: item.endTime,
            title: item.title,
            description: item.description,
            location: item.location,
            estimatedCost: item.cost,
            category: item.category,
          })),
      ),
    [draft],
  );

  async function runSave(mode: "append" | "replace", dates: string[]) {
    if (saving) return;
    setSaving(true);
    setGenerationError(undefined);
    const result =
      mode === "replace"
        ? await replaceDraftDaysAction(trip.id, { dates, items: approvedItems })
        : await addDraftItemsAction(trip.id, approvedItems);
    setSaving(false);
    if (!result.ok) {
      setGenerationError(result.error);
      return;
    }
    router.push(`/preview/trips/${trip.id}/itinerary`);
    router.refresh();
  }

  function requestSave() {
    if (approvedItems.length === 0 || saving) return;
    const dates = [...new Set(approvedItems.map((item) => item.date))].sort();
    // Warn before overwriting: the server-loaded workspace says how many saved
    // activities already live on these days.
    const existingCount = state.itinerary.filter(
      (item: ItineraryItem) =>
        item.tripId === trip.id && dates.includes(item.date),
    ).length;
    if (existingCount > 0) {
      setSaveChoice({ dates, existingCount });
      return;
    }
    void runSave("append", dates);
  }

  /* --------------------------------------------------------- rendering */

  const allItems = draft.flatMap((day) => day.items);
  const selectedItems = allItems.filter((item) => item.included);
  const selectedCount = selectedItems.length;
  const estimatedTotal = selectedItems.reduce(
    (sum, item) => sum + (item.cost ?? 0),
    0,
  );
  const budgetTotal = values.budget.trim() ? Number(values.budget) : undefined;
  const overBudget =
    budgetTotal !== undefined &&
    Number.isFinite(budgetTotal) &&
    estimatedTotal > budgetTotal;

  if (trip.isDemo) {
    return (
      <div className="card-surface p-5 sm:p-6">
        <h2 className="font-display text-[19px] font-semibold text-forest-900">
          Copy the example trip to plan with AI
        </h2>
        <p className="mt-2 max-w-xl text-[12.5px] leading-6 text-ink-500">
          The example trip is shared, read-only content, so no draft can be saved
          into it. Make your own copy first; the copy is a normal trip you own and
          can edit.
        </p>
        <div className="mt-4">
          <CopyTripButton tripId={trip.id} label="Create my own copy" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[370px_1fr] xl:items-start">
      <div className="space-y-4">
        {aiStatus && !aiStatus.configured && (
          <InlineNotice variant="preview" title="AI provider not configured">
            Generation runs through a protected server route, but this deployment
            has no AI key. Add AI_API_KEY and AI_MODEL as server secrets (and
            optionally AI_BASE_URL for an OpenAI-compatible provider) to turn it
            on. No sample suggestions are ever substituted.
          </InlineNotice>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="card-surface overflow-hidden"
        >
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-[14px] font-semibold text-forest-900">
              What should the planner know?
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">
              These details go to TripSync&apos;s server, which calls the AI
              provider with a key that never reaches your browser.
            </p>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-5">
            <Field
              id="ai-destination"
              label="Destination"
              error={errors.destination}
            >
              <Input
                id="ai-destination"
                value={values.destination}
                onChange={(event) => update("destination", event.target.value)}
                aria-invalid={Boolean(errors.destination)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="ai-start" label="Start date" error={errors.startDate}>
                <Input
                  id="ai-start"
                  type="date"
                  value={values.startDate}
                  min={trip.startDate}
                  max={trip.endDate}
                  onChange={(event) => update("startDate", event.target.value)}
                />
              </Field>
              <Field id="ai-end" label="End date" error={errors.endDate}>
                <Input
                  id="ai-end"
                  type="date"
                  value={values.endDate}
                  min={trip.startDate}
                  max={trip.endDate}
                  onChange={(event) => update("endDate", event.target.value)}
                />
              </Field>
            </div>
            {!errors.startDate && !errors.endDate && (
              <p className="-mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-400">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                {eachDay(values.startDate, values.endDate).length} days · inside the
                trip ({formatDateRange(trip.startDate, trip.endDate)})
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field
                id="ai-travellers"
                label="Travellers"
                error={errors.travellers}
              >
                <Input
                  id="ai-travellers"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={values.travellers}
                  onChange={(event) => update("travellers", event.target.value)}
                />
              </Field>
              <Field id="ai-currency" label="Currency">
                <select
                  id="ai-currency"
                  value={values.currency}
                  onChange={(event) => update("currency", event.target.value)}
                  className="h-9 w-full rounded-lg border border-line-strong bg-card px-2.5 text-[12.5px] text-ink-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              id="ai-budget"
              label="Total budget"
              optional
              hint={values.currency}
              error={errors.budget}
            >
              <Input
                id="ai-budget"
                type="number"
                min={1}
                step={1}
                placeholder="60000"
                value={values.budget}
                onChange={(event) => update("budget", event.target.value)}
                aria-invalid={Boolean(errors.budget)}
              />
            </Field>

            <fieldset>
              <legend className="text-[13px] font-medium text-forest-900">
                Pace
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-line bg-paper-100 p-1">
                {paces.map((pace) => {
                  const active = values.pace === pace;
                  return (
                    <label
                      key={pace}
                      className={cn(
                        "cursor-pointer rounded-md px-1 py-2 text-center text-[11.5px] font-medium transition-colors",
                        active
                          ? "bg-card text-forest-900 shadow-[0_1px_2px_rgba(29,39,33,0.08)]"
                          : "text-ink-500 hover:text-forest-800",
                      )}
                    >
                      <input
                        type="radio"
                        name="pace"
                        value={pace}
                        checked={active}
                        onChange={() => update("pace", pace)}
                        className="sr-only"
                      />
                      {pace}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[13px] font-medium text-forest-900">
                Interests
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {interestOptions.map((interest) => {
                  const active = interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleInterest(interest)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                        active
                          ? "border-forest-800 bg-forest-900 text-paper-50"
                          : "border-line bg-card text-ink-500 hover:border-line-strong hover:text-forest-800",
                      )}
                    >
                      {active && (
                        <Check
                          aria-hidden="true"
                          className="size-3"
                          strokeWidth={2.6}
                        />
                      )}
                      {interest}
                    </button>
                  );
                })}
              </div>
              {errors.interests && (
                <p
                  role="alert"
                  className="mt-1.5 text-[12px] font-medium text-clay-700"
                >
                  {errors.interests}
                </p>
              )}
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <Field id="ai-accommodation" label="Staying in" optional>
                <select
                  id="ai-accommodation"
                  value={values.accommodation}
                  onChange={(event) => update("accommodation", event.target.value)}
                  className="h-9 w-full rounded-lg border border-line-strong bg-card px-2.5 text-[12.5px] text-ink-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
                >
                  {accommodationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="ai-transport" label="Getting around" optional>
                <select
                  id="ai-transport"
                  value={values.transport}
                  onChange={(event) => update("transport", event.target.value)}
                  className="h-9 w-full rounded-lg border border-line-strong bg-card px-2.5 text-[12.5px] text-ink-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
                >
                  {transportOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              id="ai-dietary"
              label="Dietary preferences"
              optional
              error={errors.dietary}
            >
              <Input
                id="ai-dietary"
                placeholder="Vegetarian, no shellfish…"
                value={values.dietary}
                onChange={(event) => update("dietary", event.target.value)}
              />
            </Field>

            <Field
              id="ai-accessibility"
              label="Accessibility needs"
              optional
              error={errors.accessibility}
            >
              <Input
                id="ai-accessibility"
                placeholder="Step-free routes, minimal walking…"
                value={values.accessibility}
                onChange={(event) => update("accessibility", event.target.value)}
              />
            </Field>

            <Field
              id="ai-include"
              label="Must include"
              optional
              hint={`${values.include.length}/200`}
              error={errors.include}
            >
              <Textarea
                id="ai-include"
                className="min-h-16"
                placeholder="A specific museum, a beach morning, market food…"
                value={values.include}
                onChange={(event) => update("include", event.target.value)}
              />
            </Field>

            <Field
              id="ai-avoid"
              label="Must avoid"
              optional
              hint={`${values.avoid.length}/200`}
              error={errors.avoid}
            >
              <Textarea
                id="ai-avoid"
                className="min-h-16"
                placeholder="Crowded clubs, long drives, early mornings…"
                value={values.avoid}
                onChange={(event) => update("avoid", event.target.value)}
              />
            </Field>

            <Field
              id="ai-constraints"
              label="Anything else"
              optional
              hint={`${values.constraints.length}/300`}
              error={errors.constraints}
            >
              <Textarea
                id="ai-constraints"
                className="min-h-16"
                placeholder="Travelling with a seven-year-old, celebrating an anniversary…"
                value={values.constraints}
                onChange={(event) => update("constraints", event.target.value)}
              />
            </Field>
          </div>

          <div className="border-t border-line bg-paper-50/60 px-4 py-3 sm:px-5">
            {generationError && (
              <p
                role="alert"
                className="mb-2.5 rounded-lg border border-clay-200 bg-clay-50/60 px-3 py-2 text-[11.5px] leading-5 text-clay-700"
              >
                {generationError}
              </p>
            )}
            <Button
              type="submit"
              size="md"
              className="w-full"
              disabled={generating || aiStatus?.configured === false}
            >
              {generating ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" className="size-4" />
              )}
              {generating ? "Generating draft…" : "Generate draft"}
            </Button>
            <p className="mt-2 text-center text-[10.5px] leading-4 text-ink-400">
              Sent to the configured AI model on the server. Nothing is saved until
              you approve it.
            </p>
          </div>
        </form>

        <InlineNotice variant="info" title="Nothing is saved without review">
          The draft never silently replaces the existing itinerary. Every
          suggestion can be edited, reordered, regenerated or removed, and only
          what you approve is saved — with a confirmation if saved days already
          have activities.
        </InlineNotice>
      </div>
      <section
        id="draft-review"
        aria-labelledby="draft-heading"
        className="card-surface overflow-hidden"
      >
        <div className="flex flex-col gap-3 border-b border-line bg-paper-100/45 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Review before saving</p>
              <Badge variant="clay">
                <Sparkles aria-hidden="true" className="size-3" />
                AI draft
              </Badge>
            </div>
            <h2
              id="draft-heading"
              className="mt-1.5 font-display text-[21px] font-semibold tracking-[-0.02em] text-forest-900"
            >
              {generated
                ? `${draft.length} days in ${values.destination.split(",")[0] || trip.destination}`
                : "No draft generated yet"}
            </h2>
            <p className="mt-1 max-w-xl text-[11.5px] leading-5 text-ink-500">
              {generated
                ? "Every suggestion below is an estimate from the AI model, not a verified booking. Edit, reorder, regenerate or remove anything before saving."
                : "Choose your dates, pace and interests, then generate a draft. Nothing is created until you ask for it."}
            </p>
          </div>
          <div className="text-[11px] text-ink-500 sm:text-right">
            <p className="font-medium text-forest-900">
              {selectedCount} of {allItems.length} selected
            </p>
            <p className="mt-0.5 tabular-nums">
              Estimated total: {formatCurrency(estimatedTotal, values.currency)}
              {budgetTotal !== undefined && Number.isFinite(budgetTotal)
                ? ` of ${formatCurrency(budgetTotal, values.currency)}`
                : ""}
            </p>
          </div>
        </div>

        {overBudget && (
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <InlineNotice variant="preview" title="Estimated cost exceeds the budget">
              The selected suggestions add up to about{" "}
              {formatCurrency(estimatedTotal, values.currency)}, above the{" "}
              {formatCurrency(budgetTotal ?? 0, values.currency)} budget. Deselect
              paid activities, favour free sights, or regenerate a day asking for
              lower-cost options.
              {budgetNote ? ` The model noted: ${budgetNote}` : ""}
            </InlineNotice>
          </div>
        )}
        {!overBudget && budgetNote && (
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <InlineNotice variant="info" title="Note about the budget">
              {budgetNote}
            </InlineNotice>
          </div>
        )}

        {draft.map((day, dayIndex) => {
          const includedInDay = day.items.filter((item) => item.included);
          const dayTotal = includedInDay.reduce(
            (sum, item) => sum + (item.cost ?? 0),
            0,
          );
          const isCollapsed = collapsed.has(day.date);
          return (
            <div key={day.date} className="border-b border-line last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => toggleDay(day.date)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`day-panel-${day.date}`}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-ink-400 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                  <h3 className="font-display text-[16px] font-semibold text-forest-900">
                    Day {dayIndex + 1} · {formatDayLabel(day.date)}
                  </h3>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] tabular-nums text-ink-400">
                    {includedInDay.length} of {day.items.length} · ≈{" "}
                    {formatCurrency(dayTotal, values.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(regenerating)}
                    onClick={() => regenerateDay(day)}
                    aria-label={`Regenerate ${formatDayLabel(day.date)}`}
                  >
                    {regenerating === `day:${day.date}` ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                      />
                    ) : (
                      <RefreshCw aria-hidden="true" className="size-3.5" />
                    )}
                    <span className="hidden sm:inline">Regenerate day</span>
                  </Button>
                </div>
              </div>
              {day.summary && !isCollapsed && (
                <p className="px-4 text-[11.5px] italic text-ink-500 sm:px-5">
                  {day.summary}
                </p>
              )}

              {!isCollapsed && (
                <ul
                  id={`day-panel-${day.date}`}
                  className="space-y-2 px-4 pb-4 pt-2 sm:px-5"
                >
                  {day.items.length > 0 &&
                    bucketByTimeOfDay(day.items).map((bucket) => (
                      <Fragment key={bucket.label}>
                        <li className="flex items-center gap-2 pb-0.5 pt-2 first:pt-0">
                          <span className="eyebrow">{bucket.label}</span>
                          <span
                            aria-hidden="true"
                            className="h-px flex-1 bg-line"
                          />
                        </li>
                        {bucket.entries.map(({ item, index: itemIndex }) => (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-lg border px-3 py-3 transition-colors",
                        item.included
                          ? "border-line bg-card"
                          : "border-line bg-paper-100/40 opacity-70",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`include-${item.id}`}
                          checked={item.included}
                          onChange={() => toggleItem(day.date, item.id)}
                          className="mt-1.5 size-4 shrink-0 cursor-pointer rounded-[3px] accent-forest-800"
                        />
                        <ActivityIcon category={item.category} className="size-8" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <label
                              htmlFor={`include-${item.id}`}
                              className="cursor-pointer text-[13px] font-semibold leading-5 text-forest-900"
                            >
                              {item.title}
                            </label>
                            <span className="text-[10.5px] tabular-nums text-ink-400">
                              {formatTimeRange(item.time, item.endTime)}
                            </span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-500">
                            <span>{activityLabel(item.category)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.location}</span>
                            {item.cost !== undefined && item.cost > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  ≈ {formatCurrency(item.cost, values.currency)} per
                                  person
                                </span>
                              </>
                            )}
                          </p>
                          {item.description && (
                            <p className="mt-1.5 text-[11.5px] leading-5 text-ink-500">
                              {item.description}
                            </p>
                          )}
                          {item.verificationNote && (
                            <p className="mt-2 flex items-start gap-1.5 rounded-md border border-paper-300 bg-paper-100 px-2 py-1.5 text-[10.5px] leading-4 text-ink-500">
                              <CircleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-3 shrink-0 text-clay-600"
                              />
                              {item.verificationNote}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
                          <a
                            href={mapsUrlFor(item.location, values.destination)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Find ${item.title} on a map`}
                            className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-paper-100 hover:text-forest-800"
                          >
                            <MapPin aria-hidden="true" className="size-3.5" />
                          </a>
                          <button
                            type="button"
                            aria-label={`Regenerate ${item.title}`}
                            disabled={Boolean(regenerating)}
                            onClick={() => regenerateItem(day, item)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-paper-100 hover:text-forest-800 disabled:opacity-50"
                          >
                            {regenerating === `item:${item.id}` ? (
                              <LoaderCircle
                                aria-hidden="true"
                                className="size-3.5 animate-spin"
                              />
                            ) : (
                              <RefreshCw aria-hidden="true" className="size-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${item.title} up`}
                            disabled={itemIndex === 0}
                            onClick={() => moveItem(day.date, item.id, -1)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-paper-100 hover:text-forest-800 disabled:opacity-40"
                          >
                            <ArrowUp aria-hidden="true" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${item.title} down`}
                            disabled={itemIndex === day.items.length - 1}
                            onClick={() => moveItem(day.date, item.id, 1)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-paper-100 hover:text-forest-800 disabled:opacity-40"
                          >
                            <ArrowDown aria-hidden="true" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${item.title}`}
                            onClick={() => setEditing({ date: day.date, item })}
                            className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-paper-100 hover:text-forest-800"
                          >
                            <Pencil aria-hidden="true" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${item.title} from the draft`}
                            onClick={() => removeItem(day.date, item.id)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-clay-50 hover:text-clay-700"
                          >
                            <Trash2 aria-hidden="true" className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                        ))}
                      </Fragment>
                    ))}
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          date: day.date,
                          item: {
                            id: `manual-${day.date}-${Date.now()}`,
                            title: "",
                            time: "10:00",
                            location: values.destination.trim(),
                            category: "Activity",
                            included: true,
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2.5 py-1.5 text-[11.5px] font-medium text-ink-500 transition-colors hover:border-forest-600 hover:text-forest-800"
                    >
                      <Plus aria-hidden="true" className="size-3.5" />
                      Add an activity to {formatDayLabel(day.date)}
                    </button>
                  </li>
                  {day.items.length === 0 && (
                    <li className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-[11.5px] text-ink-400">
                      Every suggestion for this day was removed. Add one manually or
                      regenerate the day.
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}

        {allItems.length === 0 && (
          <div className="px-4 py-8 text-center sm:px-5">
            <Info aria-hidden="true" className="mx-auto size-5 text-ink-400" />
            <p className="mt-2 text-[13px] font-medium text-forest-900">
              {generated ? "The draft is empty" : "No draft yet"}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-500">
              {generated
                ? "Generate again to bring back suggestions."
                : "Use the form on the left to generate a draft from the configured AI provider."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-line bg-paper-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[10.5px] leading-4 text-ink-400">
            Approved items are saved to this trip&apos;s itinerary on the server.
            If these days already have saved activities, you choose whether to add
            alongside or replace them.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(baseline);
                setGenerationError(undefined);
              }}
              disabled={
                generating || JSON.stringify(draft) === JSON.stringify(baseline)
              }
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Reset draft
            </Button>
            <Button
              size="sm"
              disabled={selectedCount === 0 || generating || saving}
              onClick={requestSave}
            >
              {saving ? "Saving…" : `Save approved (${selectedCount})`}
            </Button>
          </div>
        </div>
      </section>

      {editing && (
        <DraftItemDialog
          title={editing.item.title ? "Edit this suggestion" : "Add an activity"}
          item={editing.item}
          siblings={
            draft
              .find((day) => day.date === editing.date)
              ?.items.filter((entry) => entry.id !== editing.item.id) ?? []
          }
          onClose={() => setEditing(null)}
          onSave={(next) => {
            saveItem(editing.date, next);
            setEditing(null);
          }}
        />
      )}

      {regenPreview && (
        <RegenerationPreviewDialog
          type={regenPreview.type}
          date={regenPreview.date}
          currency={regenPreview.currency}
          current={regenPreview.current}
          currentItems={regenPreview.currentItems}
          replacement={regenPreview.replacement}
          onClose={() => setRegenPreview(null)}
          onAccept={() => {
            regenPreview.apply(regenPreview.replacement);
            setRegenPreview(null);
          }}
        />
      )}

      {saveChoice && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSaveChoice(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>This trip already has saved activities</DialogTitle>
              <DialogDescription>
                {saveChoice.existingCount} saved{" "}
                {saveChoice.existingCount === 1 ? "activity falls" : "activities fall"}{" "}
                on the {saveChoice.dates.length === 1 ? "day" : `${saveChoice.dates.length} days`} you
                are about to save. Nothing has been changed yet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                disabled={saving}
                onClick={() => {
                  const dates = saveChoice.dates;
                  setSaveChoice(null);
                  void runSave("append", dates);
                }}
              >
                Add alongside what is already saved
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start text-clay-700"
                disabled={saving}
                onClick={() => {
                  const dates = saveChoice.dates;
                  setSaveChoice(null);
                  void runSave("replace", dates);
                }}
              >
                Replace the saved activities on those days
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                disabled={saving}
                onClick={() => setSaveChoice(null)}
              >
                Cancel — keep reviewing
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
