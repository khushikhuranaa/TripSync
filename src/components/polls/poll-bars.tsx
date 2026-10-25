import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PollOptionResult } from "@/lib/polls";

export function PollBars({
  options,
  totalVotes,
  compact = false,
  selectedOptionId,
}: {
  options: PollOptionResult[];
  totalVotes: number;
  compact?: boolean;
  selectedOptionId?: string | null;
}) {
  const leading = [...options].sort((a, b) => b.count - a.count)[0];
  const uniqueLeader =
    leading && options.filter((option) => option.count === leading.count).length === 1
      ? leading.id
      : null;

  return (
    <ul className={cn("space-y-3", compact && "space-y-2.5")}>
      {options.map((option) => {
        const selected = selectedOptionId === option.id;
        const isLeader = uniqueLeader === option.id;

        return (
          <li key={option.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1.5 text-[12px]",
                  isLeader ? "font-medium text-forest-900" : "text-ink-700",
                )}
              >
                <span className="truncate">{option.label}</span>
                {selected && (
                  <Check
                    aria-hidden="true"
                    className="size-3 shrink-0 text-clay-600"
                    strokeWidth={2.6}
                  />
                )}
                {selected && <span className="sr-only">Your selection</span>}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-400">
                {option.count} {option.count === 1 ? "vote" : "votes"} ·{" "}
                {option.percentage}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-200">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  selected ? "bg-clay-500" : isLeader ? "bg-forest-700" : "bg-sage-500",
                )}
                style={{ width: `${totalVotes === 0 ? 0 : option.percentage}%` }}
              />
            </div>
          </li>
        );
      })}
      {totalVotes === 0 && (
        <li className="text-[11.5px] text-ink-400">
          No votes yet. Be the first to weigh in.
        </li>
      )}
    </ul>
  );
}
