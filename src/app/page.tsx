import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Backpack,
  CalendarDays,
  Check,
  CircleDollarSign,
  ListChecks,
  MapPin,
  Sparkles,
  Vote,
  Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { getExpenses, getTrip } from "@/lib/sample-data";
import { summarizeExpenses } from "@/lib/money";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "TripSync — Plan the trip together",
  description:
    "A shared workspace for group trips: day-wise itinerary, shared expenses, polls, packing and notes. Start with a manual plan or an AI-assisted draft.",
};

const capabilities = [
  {
    icon: CalendarDays,
    title: "A day-by-day plan",
    copy: "Activities with times, places and costs, in one chronological view.",
  },
  {
    icon: Wallet,
    title: "Shared spending",
    copy: "See what was spent, what is left and how an equal split lands.",
  },
  {
    icon: Vote,
    title: "Group decisions",
    copy: "One clear poll instead of forty messages and two lost votes.",
  },
  {
    icon: Backpack,
    title: "The practical bits",
    copy: "Packing lists, shared notes and the details people forget.",
  },
];

const trip = getTrip("kerala");

function MiniItinerary() {
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <p className="text-[12px] font-semibold text-forest-900">
          Saturday, 19 December
        </p>
        <p className="text-[11px] text-ink-400">Day 2 of 5</p>
      </div>
      <ul className="mt-1 divide-y divide-line/80">
        {[
          ["08:30", "Breakfast at the beach shacks", "Palolem beach"],
          ["10:00", "Kayaking to Butterfly Beach", "Palolem jetty"],
          ["19:00", "Saturday night market", "Arpora, North Goa"],
        ].map(([time, title, place]) => (
          <li key={title} className="flex gap-4 py-3">
            <span className="w-11 shrink-0 pt-0.5 text-[11.5px] font-medium tabular-nums text-ink-500">
              {time}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-forest-900">
                {title}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-500">
                <MapPin aria-hidden="true" className="size-3" />
                {place}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniSplit() {
  const goaTrip = getTrip("goa");
  if (!goaTrip) return null;

  const summary = summarizeExpenses(
    getExpenses(goaTrip.id),
    goaTrip.members.map((member) => member.id),
    goaTrip.budget,
  );
  const featured = ["aarav", "khushi", "riya"].flatMap((memberId) => {
    const member = goaTrip.members.find((entry) => entry.id === memberId);
    const balance = summary.balances.find(
      (entry) => entry.memberId === memberId,
    );
    return member && balance ? [{ member, balance }] : [];
  });
  const usedPercent =
    goaTrip.budget === null
      ? 0
      : Math.min(100, Math.round((summary.total / goaTrip.budget) * 100));

  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] text-ink-500">Recorded so far</p>
          <p className="mt-0.5 font-display text-2xl font-semibold text-forest-900">
            {formatCurrency(summary.total)}
          </p>
        </div>
        {summary.remaining !== null && summary.remaining >= 0 ? (
          <Badge variant="sage">{formatCurrency(summary.remaining)} left</Badge>
        ) : (
          <Badge variant="clay">
            {formatCurrency(Math.abs(summary.remaining ?? 0))} over
          </Badge>
        )}
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-paper-200">
        <div
          className="h-full rounded-full bg-forest-700"
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      <div className="mt-4 space-y-2 border-t border-line pt-3">
        {featured.map(({ member, balance }) => {
          const settled = balance.balance >= 0;
          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 text-[12px]"
            >
              <span className="font-medium text-forest-900">
                {member.name.split(" ")[0]}
              </span>
              <span className="text-ink-500">
                Paid {formatCurrency(balance.paid)}
              </span>
              <span
                className={cn(
                  "w-24 text-right font-medium",
                  settled ? "text-forest-700" : "text-ink-500",
                )}
              >
                {settled
                  ? `+${formatCurrency(balance.balance)} back`
                  : `${formatCurrency(Math.abs(balance.balance))} owed`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-[10.5px] leading-4 text-ink-400">
        Equal split across the people included in each expense. TripSync records
        the plan; it does not move money.
      </p>
    </div>
  );
}

function MiniPoll() {
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="sage">Open · closes 25 Nov</Badge>
        <span className="text-[11px] text-ink-400">5 votes</span>
      </div>
      <p className="mt-3 text-[13.5px] font-semibold text-forest-900">
        Sunset at Palolem or Agonda?
      </p>
      <div className="mt-3 space-y-2.5">
        {[
          ["Palolem, walk from the cottages", 60, true],
          ["Agonda, drive over for the evening", 40, false],
        ].map(([label, width, leading]) => (
          <div key={String(label)}>
            <div className="flex items-center justify-between gap-3 text-[11.5px]">
              <span className={leading ? "font-medium text-forest-900" : "text-ink-500"}>
                {label}
              </span>
              <span className="text-ink-400">{width}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-200">
              <div
                className={cn(
                  "h-full rounded-full",
                  leading ? "bg-forest-700" : "bg-sage-500",
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-[10.5px] text-ink-400">
        One vote per member. Results stay visible after the poll closes.
      </p>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  number,
  title,
  copy,
  children,
}: {
  icon: typeof CalendarDays;
  number: string;
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <article className="grid gap-5 py-8 first:pt-0 last:pb-0 sm:grid-cols-[1fr_1.05fr] sm:gap-8 lg:gap-10">
      <div>
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-card text-forest-700">
            <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.7} />
          </span>
          <span className="text-[10px] font-semibold tracking-[0.18em] text-ink-400">
            {number}
          </span>
        </div>
        <h3 className="mt-4 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-forest-900">
          {title}
        </h3>
        <p className="mt-2 text-[13.5px] leading-6 text-ink-500">{copy}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </article>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-paper-50">
      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="page-container grid gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:pb-28 lg:pt-20">
            <div>
              <p className="eyebrow flex items-center gap-2.5">
                <span aria-hidden="true" className="h-px w-7 bg-clay-500" />
                A shared plan for group trips
              </p>

              <h1 className="display-heading mt-5 max-w-[640px] text-[40px] leading-[1.02] text-forest-900 sm:text-[50px] lg:text-[54px]">
                Plan the trip together.
                <span className="mt-1 block text-forest-700">
                  Keep every detail in one place.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-[15px] leading-7 text-ink-500 sm:text-[16px]">
                TripSync is a shared workspace for friends, family and
                classmates. Build a day-wise itinerary, keep the budget honest,
                settle the small decisions, and stop hunting through group chats
                for the plan.
              </p>

              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Link
                  href="/sign-up"
                  className={buttonStyles({ variant: "primary", size: "lg" })}
                >
                  Create an account
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link
                  href="/sign-in"
                  className={buttonStyles({ variant: "secondary", size: "lg" })}
                >
                  Sign in
                </Link>
              </div>

            </div>

            <div className="relative min-w-0 lg:pb-10">
              <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-line bg-paper-200 shadow-lift sm:aspect-[4/3] lg:aspect-[5/5.4]">
                <Image
                  src="/images/kerala-houseboat.jpg"
                  alt="A traditional thatched houseboat on the Kerala backwaters, surrounded by palm trees"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 540px"
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,35,26,0.62)_0%,rgba(12,35,26,0.08)_48%,transparent_70%)]"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-4 p-5 sm:p-6">
                  {trip && <AvatarStack members={trip.members} max={3} size="sm" />}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-line bg-card p-4 shadow-soft lg:absolute lg:-bottom-2 lg:-left-8 lg:mt-0 lg:w-[314px] lg:shadow-lift">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-clay-700">
                    Sample trip · Kerala
                  </p>
                  <p className="text-[10.5px] text-ink-400">Mon 4 Jan</p>
                </div>
                <div className="mt-2.5 flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-forest-700">
                    <CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-ink-500">
                      Day 2 · Alleppey
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-forest-900">
                      Houseboat check-in
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-ink-500">
                      12:00 pm · Punnamada
                    </p>
                  </div>
                </div>
                <p className="mt-3 border-t border-line pt-2.5 text-[10px] text-ink-400">
                  Illustrative itinerary · not a real booking
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capability strip */}
        <section
          aria-label="What TripSync includes"
          className="border-y border-line bg-paper-100/55"
        >
          <div className="page-container grid gap-x-8 gap-y-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:py-9">
            {capabilities.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="flex gap-3">
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 size-[18px] shrink-0 text-forest-600"
                  strokeWidth={1.7}
                />
                <div>
                  <p className="text-[12.5px] font-semibold text-forest-900">{title}</p>
                  <p className="mt-1 text-[11.5px] leading-5 text-ink-500">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Product detail */}
        <section id="product" className="scroll-mt-20">
          <div className="page-container py-16 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <p className="eyebrow">One shared workspace</p>
                <h2 className="display-heading mt-3 text-[32px] text-forest-900 sm:text-[38px]">
                  The plan, the money and the decisions, together.
                </h2>
                <p className="mt-4 max-w-md text-[14px] leading-6 text-ink-500">
                  Everyone sees the same version of the trip. The itinerary stays
                  in time order, expenses show their arithmetic, and a poll has
                  one place to live.
                </p>
                <Link
                  href="/preview/trips/goa"
                  className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-forest-800 underline decoration-line-strong underline-offset-4 transition-colors hover:text-clay-700 hover:decoration-clay-300"
                >
                  Open the sample trip
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-line border-y border-line">
                <FeatureRow
                  icon={ListChecks}
                  number="01"
                  title="A day that everyone can follow"
                  copy="Plan each day in order, with a time, a place and an honest cost estimate. Add it yourself, or start from an AI draft and keep only what the group agrees on."
                >
                  <MiniItinerary />
                </FeatureRow>

                <FeatureRow
                  icon={CircleDollarSign}
                  number="02"
                  title="Money without the group-chat arithmetic"
                  copy="Record who paid, what it covered and who was there. TripSync shows the total, the budget left and the equal split, with the calculation visible instead of mysterious."
                >
                  <MiniSplit />
                </FeatureRow>

                <FeatureRow
                  icon={Vote}
                  number="03"
                  title="Decisions that do not get lost"
                  copy="Ask one clear question, give people real options, and close the vote when it is time. No more counting reactions or wondering which plan won."
                >
                  <MiniPoll />
                </FeatureRow>
              </div>
            </div>
          </div>
        </section>

        {/* AI planner */}
        <section id="ai-planner" className="scroll-mt-20 bg-forest-900 text-paper-50">
          <div className="page-container grid gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:py-20">
            <div>
              <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-sage-300">
                <Sparkles aria-hidden="true" className="size-3.5" />
                AI-assisted planning
              </p>
              <h2 className="display-heading mt-3 max-w-lg text-[32px] text-paper-50 sm:text-[40px]">
                A first draft, not a final answer.
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-6 text-paper-100/75">
                Tell the planner where you are going, what you enjoy and how
                packed you want the days to be. It suggests a structure. You
                decide what survives.
              </p>

              <ul className="mt-7 space-y-3">
                {[
                  "Review every suggestion in a day-by-day draft.",
                  "Edit, remove or reorder activities before saving.",
                  "Approved items are added to the plan. Nothing is replaced silently.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] leading-5 text-paper-100/85">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-sage-300"
                      strokeWidth={2.4}
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/preview/trips/goa/ai-planner"
                className="mt-7 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-paper-50 underline decoration-paper-50/30 underline-offset-4 transition-colors hover:decoration-paper-50"
              >
                See the AI planner layout
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>

            <div className="rounded-xl bg-paper-50 p-4 text-ink-900 shadow-lift sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-clay-700">
                    Draft · Jaipur, 3 days
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-forest-900">
                    Balanced pace · food and history
                  </p>
                </div>
                <Badge variant="muted">Sample output</Badge>
              </div>

              <div className="mt-3 space-y-2">
                {[
                  ["08:00", "Amber Fort before the crowds", "Amer · approx. ₹1,100"],
                  ["13:00", "Lunch at Tapri Central", "C-Scheme · approx. ₹1,200"],
                  ["16:30", "City Palace and textile galleries", "Old City · approx. ₹1,400"],
                ].map(([time, title, meta], index) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-lg border border-line bg-card px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border",
                        index === 2
                          ? "border-line-strong bg-card"
                          : "border-forest-800 bg-forest-800 text-paper-50",
                      )}
                    >
                      {index !== 2 && (
                        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-[12.5px] font-medium text-forest-900">
                          {title}
                        </span>
                        <span className="text-[10.5px] tabular-nums text-ink-400">
                          {time}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-ink-500">
                        {meta}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-[10.5px] text-ink-400">2 of 3 selected</p>
                <span className="inline-flex h-8 items-center rounded-lg bg-forest-900 px-3 text-[11.5px] font-medium text-paper-50">
                  Save approved activities
                </span>
              </div>
              <p className="mt-2.5 text-[10px] leading-4 text-ink-400">
                Suggestions may be out of date. Check opening hours, tickets and
                prices before relying on them.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="page-container py-16 lg:py-20">
            <div className="max-w-xl">
              <p className="eyebrow">How it works</p>
              <h2 className="display-heading mt-3 text-[32px] text-forest-900 sm:text-[36px]">
                From “we should go somewhere” to an actual plan.
              </h2>
            </div>

            <ol className="mt-9 grid gap-8 border-t border-line pt-8 sm:grid-cols-3 sm:gap-10">
              {[
                {
                  number: "01",
                  title: "Start the trip",
                  copy: "Add the destination, dates and a rough budget, then bring the group in.",
                },
                {
                  number: "02",
                  title: "Build the days",
                  copy: "Add plans by hand, or generate a draft and keep only the activities you approve.",
                },
                {
                  number: "03",
                  title: "Keep it together",
                  copy: "Use one workspace for spending, polls, packing and the notes nobody should lose.",
                },
              ].map((step) => (
                <li key={step.number}>
                  <p className="font-display text-[28px] font-medium text-clay-600">
                    {step.number}
                  </p>
                  <h3 className="mt-2 text-[14px] font-semibold text-forest-900">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-6 text-ink-500">
                    {step.copy}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-y border-line bg-paper-100/70">
          <div className="page-container flex flex-col gap-7 py-12 sm:flex-row sm:items-center sm:justify-between lg:py-14">
            <div>
              <p className="eyebrow">Your account</p>
              <h2 className="display-heading mt-2 max-w-xl text-[28px] text-forest-900 sm:text-[32px]">
                Sign in and look around the workspace.
              </h2>
              <p className="mt-2 max-w-xl text-[12.5px] leading-5 text-ink-500">
                Accounts, sessions and sign-in are real, and the trips in the
                workspace are stored in the database — create one, sign out and
                sign back in, and it is still there.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                href="/sign-up"
                className={buttonStyles({ variant: "primary", size: "lg" })}
              >
                Create an account
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="text-[11.5px] font-medium text-ink-500 underline decoration-line-strong underline-offset-4 hover:text-forest-800"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
