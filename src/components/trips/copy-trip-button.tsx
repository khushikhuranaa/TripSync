"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo-store";

export function CopyTripButton({
  tripId,
  variant = "secondary",
  size = "md",
  label = "Create my own copy",
  className,
}: {
  tripId: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { copyTrip } = useDemoStore();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={async () => {
        if (pending) return;
        setPending(true);
        const copy = await copyTrip(tripId);
        setPending(false);
        if (copy) router.push(`/preview/trips/${copy.id}`);
      }}
    >
      <CopyPlus aria-hidden="true" className="size-4" />
      {pending ? "Copying…" : label}
    </Button>
  );
}
