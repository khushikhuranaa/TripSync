"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AiPlanner } from "@/components/ai-planner/ai-planner";
import { useDemoStore } from "@/lib/demo-store";
import { TripUnavailable } from "@/components/trips/trip-unavailable";

export default function AiPlannerPage() {
  const params = useParams<{ tripId: string }>();
  const { state } = useDemoStore();
  const trip = state.trips.find((entry) => entry.id === params.tripId);

  if (!trip) return <TripUnavailable />;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/preview/trips/${trip.id}/itinerary`}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500 transition-colors hover:text-forest-800"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to itinerary
        </Link>
      </div>

      <PageHeader
        eyebrow="AI-assisted planning"
        title="Draft the days, then decide."
        description="Give the planner a direction. Review every suggestion, edit, reorder, regenerate or remove what does not fit, and save only the activities you approve."
        actions={
          <Badge variant="clay">
            <Sparkles aria-hidden="true" className="size-3" />
            Server-side AI
          </Badge>
        }
      />

      <AiPlanner trip={trip} defaultStyle={state.profile.travelStyle} />

      <p className="text-[11px] leading-5 text-ink-400">
        AI suggestions are always treated as drafts. Opening hours, prices and
        availability must be checked independently; TripSync does not claim live
        verification. Generation is limited per account to keep provider costs
        predictable.
      </p>
    </div>
  );
}
