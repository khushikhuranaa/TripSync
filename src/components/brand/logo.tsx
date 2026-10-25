import { cn } from "@/lib/cn";

export function LogoMark({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const background = tone === "light" ? "#FBF8F1" : "#123227";
  const line = tone === "light" ? "#123227" : "#FBF8F1";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] border",
        tone === "light" ? "border-paper-50/20" : "border-forest-950/10",
        className,
      )}
      style={{ backgroundColor: background }}
    >
      <svg viewBox="0 0 32 32" className="size-5" fill="none">
        <path
          d="M8 22c4.5 0 4.5-12 9-12s4.5 12 7 12"
          stroke={line}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="8" cy="22" r="2" fill="#B65C3E" />
        <circle cx="24" cy="10" r="2" fill="#B65C3E" />
      </svg>
    </span>
  );
}

export function Logo({
  tone = "dark",
  className,
  subtitle,
}: {
  tone?: "dark" | "light";
  className?: string;
  subtitle?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-display text-[21px] font-semibold leading-none tracking-[-0.025em]",
            tone === "light" ? "text-paper-50" : "text-forest-900",
          )}
        >
          TripSync
        </span>
        {subtitle && (
          <span
            className={cn(
              "mt-1 block text-[9px] font-semibold uppercase leading-none tracking-[0.2em]",
              tone === "light" ? "text-paper-200/70" : "text-ink-400",
            )}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
