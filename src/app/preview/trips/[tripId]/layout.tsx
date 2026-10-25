import { TripShell } from "@/components/trips/trip-shell";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  // Access checks, live trip lookup and the missing-trip state all live in the
  // client demo store for this frontend stage. A real backend will replace this
  // with a server-side membership query.
  return <TripShell tripId={tripId}>{children}</TripShell>;
}
