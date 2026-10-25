import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TripStatus } from "@/lib/types";

type BadgeVariant =
  | "neutral"
  | "forest"
  | "sage"
  | "clay"
  | "outline"
  | "muted";

const variants: Record<BadgeVariant, string> = {
  neutral: "border-paper-300 bg-paper-100 text-ink-700",
  forest: "border-forest-800/15 bg-forest-900 text-paper-50",
  sage: "border-sage-300/70 bg-sage-100 text-forest-800",
  clay: "border-clay-200 bg-clay-50 text-clay-700",
  outline: "border-line-strong bg-transparent text-ink-700",
  muted: "border-line bg-paper-100 text-ink-500",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 tracking-[0.01em]",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusCopy: Record<TripStatus, string> = {
  upcoming: "Upcoming",
  ongoing: "Happening now",
  completed: "Completed",
};

const statusDot: Record<TripStatus, string> = {
  upcoming: "bg-forest-600",
  ongoing: "bg-clay-500",
  completed: "bg-ink-400",
};

export function TripStatusBadge({
  status,
  className,
}: {
  status: TripStatus;
  className?: string;
}) {
  const variant: BadgeVariant =
    status === "ongoing"
      ? "clay"
      : status === "completed"
        ? "muted"
        : "sage";

  return (
    <Badge variant={variant} className={className}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", statusDot[status])}
      />
      {statusCopy[status]}
    </Badge>
  );
}
