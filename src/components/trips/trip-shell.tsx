"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { TripHeader } from "@/components/trips/trip-header";
import { TripTabs } from "@/components/trips/trip-tabs";
import { EmptyState } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo-store";

export function TripShell({
  tripId,
  children,
}: {
  tripId: string;
  children: React.ReactNode;
}) {
  const { state } = useDemoStore();
  const trip = state.trips.find((entry) => entry.id === tripId);

  if (!trip) {
    // The workspace only ever contains trips this account is a member of, so a
    // deleted trip and somebody else's trip id both land here — with no data.
    return (
      <EmptyState
        icon={MapPin}
        title="This trip is not in your workspace"
        description="It may have been deleted, or you may no longer have access to it. Your other trips are still available."
        action={
          <Link
            href="/preview/trips"
            className={buttonStyles({ variant: "primary", size: "md" })}
          >
            Back to My trips
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <TripHeader trip={trip} />
      <TripTabs tripId={trip.id} />
      <div className="pt-6">{children}</div>
    </div>
  );
}
