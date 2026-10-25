"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  LoaderCircle,
  NotebookPen,
  Sparkles,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTripDialog } from "@/components/app-shell/create-trip-dialog";
import { useDemoStore } from "@/lib/demo-store";
import { completeOnboardingAction } from "@/server/actions";

const steps = [
  {
    icon: Sparkles,
    title: "Create a trip",
    body: "Name it, set the dates and give the group a budget.",
  },
  {
    icon: CalendarDays,
    title: "Build the itinerary",
    body: "Add activities day by day with times, places and rough costs.",
  },
  {
    icon: Wallet,
    title: "Split expenses",
    body: "Record what was paid and see each person's share instantly.",
  },
  {
    icon: UsersRound,
    title: "Invite collaborators",
    body: "Send an invitation link and choose editor or view-only access.",
  },
  {
    icon: BarChart3,
    title: "Decide with polls",
    body: "Ask the group a question and let everyone vote once.",
  },
  {
    icon: ClipboardList,
    title: "Pack and take notes",
    body: "Keep a shared packing list and the booking details in one place.",
  },
];

export function OnboardingCard() {
  const router = useRouter();
  const { state, notify } = useDemoStore();
  const [pending, setPending] = useState<"skip" | "done" | null>(null);

  if (state.profile.onboardingCompletedAt) return null;

  async function finish(mode: "skip" | "done") {
    if (pending) return;
    setPending(mode);
    const result = await completeOnboardingAction();
    setPending(null);
    if (!result.ok) {
      notify(result.error, "error");
      return;
    }
    notify(
      mode === "skip"
        ? "Tour closed. You can replay it from your profile."
        : "You are ready to plan.",
    );
    router.refresh();
  }

  return (
    <section
      aria-labelledby="onboarding-heading"
      className="overflow-hidden rounded-xl border border-forest-900/10 bg-[linear-gradient(110deg,#f4f7ef_0%,#fbf7ef_55%,#f8e9df_100%)] shadow-soft"
    >
      <div className="flex flex-col gap-4 border-b border-forest-900/10 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-forest-900/10 bg-card text-forest-700">
            <Sparkles aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-clay-700">
              First time here
            </p>
            <h2
              id="onboarding-heading"
              className="mt-0.5 font-display text-[19px] font-semibold tracking-[-0.01em] text-forest-900"
            >
              A quick tour of TripSync
            </h2>
            <p className="mt-1 max-w-xl text-[11.5px] leading-5 text-ink-500">
              Six things the group can do together. Take a minute now, or skip
              and explore on your own — you can replay this from your profile.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void finish("skip")}
          disabled={pending !== null}
          className="self-start text-ink-500"
        >
          {pending === "skip" ? (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <X aria-hidden="true" className="size-3.5" />
          )}
          Skip tour
        </Button>
      </div>

      <ol className="grid gap-x-5 gap-y-3 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-forest-900/10 bg-card text-forest-700">
                <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-forest-900">
                  <span className="mr-1 text-clay-600">{index + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-ink-500">
                  {step.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 border-t border-forest-900/10 bg-paper-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Link
          href="/preview/trips/goa"
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-forest-800 hover:text-clay-700"
        >
          Explore the read-only example trip
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
        <div className="flex items-center gap-2">
          <CreateTripDialog triggerLabel="Create my first trip" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void finish("done")}
            disabled={pending !== null}
          >
            {pending === "done" ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <NotebookPen aria-hidden="true" className="size-3.5" />
            )}
            Got it
          </Button>
        </div>
      </div>
    </section>
  );
}
