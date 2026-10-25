import type { ISODate, ISODateTime, Trip, TripStatus } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse a date-only string at midday UTC so timezone shifts cannot move the day. */
function asDate(iso: ISODate): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function toISODate(date = new Date()): ISODate {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDate(
  iso: ISODate,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(asDate(iso));
}

export function formatDateShort(iso: ISODate): string {
  return formatDate(iso, { year: undefined });
}

/** "18–22 Dec 2026" when the month matches, otherwise a full range. */
export function formatDateRange(start: ISODate, end: ISODate): string {
  const a = asDate(start);
  const b = asDate(end);
  const sameMonth =
    a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();

  if (start === end) return formatDate(start);

  if (sameMonth) {
    const month = new Intl.DateTimeFormat("en-IN", {
      month: "short",
      timeZone: "UTC",
    }).format(b);
    return `${a.getUTCDate()}–${b.getUTCDate()} ${month} ${b.getUTCFullYear()}`;
  }

  if (sameYear) {
    return `${formatDateShort(start)} – ${formatDateShort(end)} ${b.getUTCFullYear()}`;
  }

  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatDayLabel(iso: ISODate): string {
  const d = asDate(iso);
  return `${DAY_LABELS[d.getUTCDay()]} ${d.getUTCDate()} ${new Intl.DateTimeFormat(
    "en-IN",
    { month: "short", timeZone: "UTC" },
  ).format(d)}`;
}

export function formatWeekday(iso: ISODate): string {
  return DAY_LABELS[asDate(iso).getUTCDay()];
}

/** Convert 24-hour "14:30" to "2:30 pm". */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(start: string, end?: string): string {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

/** Whole days between today and the date. Negative once the date has passed. */
export function daysUntil(iso: ISODate, today = new Date()): number {
  const target = Date.parse(`${iso}T00:00:00Z`);
  const current = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.round((target - current) / 86_400_000);
}

export function tripStatus(trip: Pick<Trip, "startDate" | "endDate">, today = new Date()): TripStatus {
  const start = daysUntil(trip.startDate, today);
  const end = daysUntil(trip.endDate, today);
  if (start > 0) return "upcoming";
  if (end < 0) return "completed";
  return "ongoing";
}

/** Inclusive list of dates, e.g. a five-day trip returns five ISO dates. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const days: ISODate[] = [];
  const last = Date.parse(`${end}T00:00:00Z`);
  for (
    let cursor = Date.parse(`${start}T00:00:00Z`);
    cursor <= last;
    cursor += 86_400_000
  ) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}

export function tripLength(start: ISODate, end: ISODate): number {
  return Math.max(1, daysUntil(end, asDate(start)) + 1);
}

export function formatCurrency(amount: number, currency = "INR"): string {
  // Whole amounts stay readable, while a share such as ₹333.34 keeps its paise
  // instead of being rounded into a different number on screen.
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function relativeDay(isoDate: ISODateTime, today = new Date()): string {
  const date = new Date(isoDate);
  const diff = Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff < 0 && diff > -7) return `${Math.abs(diff)} days ago`;
  return formatDate(isoDate.slice(0, 10), { year: "numeric" });
}

export function departureLabel(iso: ISODate, today = new Date()): string {
  const days = daysUntil(iso, today);
  if (days === 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  if (days > 1) return `${days} days to go`;
  if (days === -1) return "Ended yesterday";
  return `Ended ${Math.abs(days)} days ago`;
}
