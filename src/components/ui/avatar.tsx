import { cn } from "@/lib/cn";
import type { AvatarTone, Member } from "@/lib/types";

const tones: Record<AvatarTone, string> = {
  forest: "bg-forest-800 text-paper-50",
  clay: "bg-clay-100 text-clay-700",
  sage: "bg-sage-200 text-forest-800",
  sand: "bg-paper-200 text-ink-700",
  ink: "bg-ink-700 text-paper-50",
};

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
};

export function Avatar({
  member,
  size = "md",
  className,
  showRing = false,
}: {
  member: Pick<Member, "initials" | "tone" | "name">;
  size?: keyof typeof sizes;
  className?: string;
  showRing?: boolean;
}) {
  return (
    <span
      title={member.name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-[0.02em]",
        tones[member.tone],
        sizes[size],
        showRing && "ring-2 ring-card",
        className,
      )}
    >
      <span aria-hidden="true">{member.initials}</span>
      <span className="sr-only">{member.name}</span>
    </span>
  );
}

export function AvatarStack({
  members,
  max = 4,
  size = "sm",
}: {
  members: Member[];
  max?: number;
  size?: keyof typeof sizes;
}) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((member) => (
          <Avatar
            key={member.id}
            member={member}
            size={size}
            showRing
            className="ring-card"
          />
        ))}
        {overflow > 0 && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full bg-paper-200 font-semibold text-ink-700 ring-2 ring-card",
              sizes[size],
            )}
            title={`${overflow} more ${overflow === 1 ? "member" : "members"}`}
          >
            +{overflow}
          </span>
        )}
      </div>
      <span className="sr-only">
        {members.length} {members.length === 1 ? "member" : "members"}
      </span>
    </div>
  );
}

export function MemberName({
  member,
  className,
}: {
  member: Member;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Avatar member={member} size="xs" />
      <span className="text-sm text-ink-700">{member.name}</span>
    </span>
  );
}
