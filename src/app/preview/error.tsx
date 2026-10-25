"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";

export default function PreviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep diagnostics in the console without exposing stack traces to users.
    console.error("TripSync preview error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full border border-clay-200 bg-clay-50 text-clay-700">
        <TriangleAlert aria-hidden="true" className="size-5" strokeWidth={1.8} />
      </span>
      <h1 className="mt-4 font-display text-[26px] font-semibold text-forest-900">
        Something went wrong on this page
      </h1>
      <p className="mt-2 max-w-md text-[12.5px] leading-5 text-ink-500">
        No data was saved. You can try loading the page again, or return to the
        workspace and open a different section.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} size="md">
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </Button>
        <Link
          href="/preview/dashboard"
          className={buttonStyles({ variant: "secondary", size: "md" })}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
