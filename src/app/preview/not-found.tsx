import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

export default function PreviewNotFound() {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full border border-line bg-card text-forest-700">
        <MapPinOff aria-hidden="true" className="size-5" strokeWidth={1.8} />
      </span>
      <h1 className="mt-4 font-display text-[26px] font-semibold text-forest-900">
        This trip isn&apos;t available
      </h1>
      <p className="mt-2 max-w-md text-[12.5px] leading-5 text-ink-500">
        The address may be wrong, or the trip may no longer exist. In the real
        app, a non-member will see the same message so private trip details are
        never exposed.
      </p>
      <Link
        href="/preview/trips"
        className={buttonStyles({
          variant: "secondary",
          size: "md",
          className: "mt-5",
        })}
      >
        Back to my trips
      </Link>
    </div>
  );
}
