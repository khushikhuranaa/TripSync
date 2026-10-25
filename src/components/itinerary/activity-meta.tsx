import {
  BedDouble,
  Bus,
  Coffee,
  Landmark,
  ShoppingBag,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ActivityCategory } from "@/lib/types";

const meta: Record<
  ActivityCategory,
  { icon: LucideIcon; tone: string; label: string }
> = {
  Food: { icon: Utensils, tone: "bg-clay-50 text-clay-700", label: "Food" },
  Stay: { icon: BedDouble, tone: "bg-sage-100 text-forest-700", label: "Stay" },
  Transport: { icon: Bus, tone: "bg-paper-200 text-ink-700", label: "Transport" },
  Activity: { icon: Ticket, tone: "bg-sage-100 text-forest-700", label: "Activity" },
  Sightseeing: {
    icon: Landmark,
    tone: "bg-paper-200 text-ink-700",
    label: "Sightseeing",
  },
  Shopping: {
    icon: ShoppingBag,
    tone: "bg-clay-50 text-clay-700",
    label: "Shopping",
  },
  "Free time": {
    icon: Coffee,
    tone: "bg-sage-50 text-sage-700",
    label: "Free time",
  },
};

export function ActivityIcon({
  category,
  className,
}: {
  category: ActivityCategory;
  className?: string;
}) {
  const config = meta[category];
  const Icon = config.icon;
  return (
    <span
      className={[
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
        config.tone,
        className ?? "",
      ].join(" ")}
      title={config.label}
    >
      <Icon aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
    </span>
  );
}

export function activityLabel(category: ActivityCategory): string {
  return meta[category].label;
}
