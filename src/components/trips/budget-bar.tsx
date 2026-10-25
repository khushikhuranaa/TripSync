import { ProgressBar } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";

export function BudgetBar({
  budget,
  spent,
  currency = "INR",
  className,
  showLabels = true,
  showRemaining = true,
}: {
  budget: number | null;
  spent: number;
  currency?: "INR";
  className?: string;
  showLabels?: boolean;
  showRemaining?: boolean;
}) {
  const overBudget = budget !== null && spent > budget;
  const remaining = budget === null ? null : budget - spent;

  return (
    <div className={cn("space-y-2", className)}>
      {showLabels && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[12px] text-ink-500">
            {budget === null ? "No budget set" : "Budget used"}
          </p>
          <p className="text-[12px] font-medium text-forest-900">
            {formatCurrency(spent, currency)}
            {budget !== null && (
              <span className="font-normal text-ink-400">
                {" "}
                of {formatCurrency(budget, currency)}
              </span>
            )}
          </p>
        </div>
      )}

      <ProgressBar
        value={spent}
        max={budget ?? Math.max(spent, 1)}
        tone={overBudget ? "clay" : "forest"}
        label={
          budget === null
            ? `Spent ${formatCurrency(spent, currency)} with no budget set`
            : `${formatCurrency(spent, currency)} spent of ${formatCurrency(budget, currency)}`
        }
      />

      {budget !== null && showRemaining && (
        <p
          className={cn(
            "text-[11.5px]",
            overBudget ? "font-medium text-clay-700" : "text-ink-500",
          )}
        >
          {overBudget
            ? `${formatCurrency(Math.abs(remaining ?? 0), currency)} over budget`
            : `${formatCurrency(remaining ?? 0, currency)} remaining`}
        </p>
      )}
    </div>
  );
}
