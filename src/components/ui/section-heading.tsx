import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-forest-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-ink-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
