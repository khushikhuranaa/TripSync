"use client";

import { useParams } from "next/navigation";
import { ItineraryView } from "@/components/itinerary/itinerary-view";
import { toISODate } from "@/lib/format";

export default function ItineraryPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId as string;

  return (
    <div>
      <ItineraryView tripId={tripId} today={toISODate()} />
    </div>
  );
}
