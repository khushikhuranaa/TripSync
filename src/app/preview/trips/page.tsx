"use client";

import { PageHeader } from "@/components/ui/page-header";
import { CreateTripDialog } from "@/components/app-shell/create-trip-dialog";
import { TripsView, type TripEntry } from "@/components/trips/trips-view";
import { useDemoStore } from "@/lib/demo-store";
import { tripStatus } from "@/lib/format";

export default function TripsPage() {
  const { state } = useDemoStore();
  const trips = state.trips.filter((trip) =>
    trip.members.some((member) => member.id === state.profile.id),
  );

  const entries: TripEntry[] = trips
    .map((trip) => ({ trip, status: tripStatus(trip) }))
    .sort((a, b) => {
      const order = { ongoing: 0, upcoming: 1, completed: 2 };
      return (
        order[a.status] - order[b.status] ||
        a.trip.startDate.localeCompare(b.trip.startDate)
      );
    });

  const owned = trips.filter((trip) => trip.ownerId === state.profile.id).length;
  const joined = trips.length - owned;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your workspace"
        title="My trips"
        description={`${owned} trips you own and ${joined} you have joined. Open a trip to see its itinerary, spending and shared decisions.`}
        actions={
          <div className="hidden sm:block">
            <CreateTripDialog triggerLabel="Create a trip" />
          </div>
        }
      />

      <TripsView entries={entries} currentUserId={state.profile.id} />

      <p className="text-[11px] leading-5 text-ink-400">
        Every trip here is stored in your TripSync account — sign in on another
        device and the same trips, itinerary and expenses are waiting.
      </p>
    </div>
  );
}
