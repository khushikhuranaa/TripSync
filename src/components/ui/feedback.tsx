import type { LucideIcon } from "lucide-react";
import { Info, TriangleAlert, CircleCheck, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start rounded-xl border border-dashed border-line-strong bg-paper-50/60 px-6 py-10 sm:items-center sm:px-8 sm:text-center",
        className,
      )}
    >
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-full border border-line bg-card text-forest-700">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
      <h3 className="text-base font-semibold tracking-[-0.01em] text-forest-900">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-500">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type NoticeVariant = "info" | "preview" | "warning" | "success" | "danger";

const noticeStyles: Record<
  NoticeVariant,
  { box: string; icon: LucideIcon; iconClass: string }
> = {
  info: {
    box: "border-line bg-paper-100/70 text-ink-700",
    icon: Info,
    iconClass: "text-forest-600",
  },
  preview: {
    box: "border-clay-200 bg-clay-50/70 text-clay-700",
    icon: Eye,
    iconClass: "text-clay-600",
  },
  warning: {
    box: "border-paper-300 bg-paper-100 text-ink-700",
    icon: TriangleAlert,
    iconClass: "text-clay-600",
  },
  success: {
    box: "border-sage-300 bg-sage-50 text-forest-800",
    icon: CircleCheck,
    iconClass: "text-forest-600",
  },
  danger: {
    box: "border-clay-200 bg-clay-50 text-clay-700",
    icon: TriangleAlert,
    iconClass: "text-clay-600",
  },
};

export function InlineNotice({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: NoticeVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const style = noticeStyles[variant];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[13px] leading-5",
        style.box,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", style.iconClass)}
        strokeWidth={1.9}
      />
      <div className="min-w-0">
        {title && <p className="font-semibold text-forest-900">{title}</p>}
        <div className={cn(title && "mt-0.5", "text-ink-700")}>{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = "forest",
  className,
}: {
  value: number;
  max?: number;
  label: string;
  tone?: "forest" | "clay" | "sage";
  className?: string;
}) {
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const toneClass =
    tone === "clay" ? "bg-clay-500" : tone === "sage" ? "bg-sage-500" : "bg-forest-700";

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeMax)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-paper-200", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", toneClass)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-paper-200/80", className)}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading page">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
