import {
  BedDouble,
  Bus,
  ReceiptText,
  ShoppingBag,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ExpenseCategory } from "@/lib/types";

const meta: Record<
  ExpenseCategory,
  { icon: LucideIcon; tone: string }
> = {
  Stay: { icon: BedDouble, tone: "bg-sage-100 text-forest-700" },
  Food: { icon: Utensils, tone: "bg-clay-50 text-clay-700" },
  Transport: { icon: Bus, tone: "bg-paper-200 text-ink-700" },
  Activities: { icon: Ticket, tone: "bg-sage-100 text-forest-700" },
  Shopping: { icon: ShoppingBag, tone: "bg-clay-50 text-clay-700" },
  Other: { icon: ReceiptText, tone: "bg-paper-200 text-ink-700" },
};

export function ExpenseIcon({
  category,
  className,
}: {
  category: ExpenseCategory;
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
    >
      <Icon aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
    </span>
  );
}
