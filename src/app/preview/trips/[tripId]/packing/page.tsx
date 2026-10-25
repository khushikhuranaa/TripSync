"use client";

import { useParams } from "next/navigation";
import { PackingList } from "@/components/packing/packing-list";

export default function PackingPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId as string;

  return <PackingList tripId={tripId} />;
}
