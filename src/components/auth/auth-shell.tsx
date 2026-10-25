import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarRange, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const points = [
  {
    icon: Users,
    title: "One shared plan",
    copy: "Every traveller sees the same itinerary, spending and decisions.",
  },
  {
    icon: CalendarRange,
    title: "Days, not group chats",
    copy: "Build the itinerary day by day, with an AI draft you review first.",
  },
  {
    icon: ShieldCheck,
    title: "Only your group",
    copy: "Trips are private to their members. Roles decide who can edit.",
  },
];

/**
 * Shared frame for sign-in, sign-up and password screens.
 * The form is an ordinary labelled HTML form; this component only lays it out.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper-50">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col lg:flex-row">
        <aside className="relative hidden w-[44%] max-w-[500px] shrink-0 flex-col justify-between overflow-hidden bg-forest-900 px-10 py-11 text-paper-50 lg:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[radial-gradient(120%_90%_at_15%_100%,rgba(181,106,74,0.28),transparent_62%)]"
          />
          <div className="relative">
            <Link
              href="/"
              className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper-50"
            >
              <Logo tone="light" subtitle="Travel planning" />
            </Link>

            <h2 className="mt-14 max-w-[19ch] font-display text-[30px] font-semibold leading-[1.18] tracking-[-0.02em]">
              Plan the trip together, not in five group chats.
            </h2>
            <p className="mt-3 max-w-[34ch] text-[12.5px] leading-6 text-paper-200/75">
              TripSync keeps the itinerary, the budget and the decisions in one
              place your group can actually use.
            </p>

            <ul className="mt-9 space-y-5">
              {points.map(({ icon: Icon, title: pointTitle, copy }) => (
                <li key={pointTitle} className="flex gap-3.5">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-paper-50/12 bg-paper-50/[0.06]">
                    <Icon
                      aria-hidden="true"
                      className="size-4 text-clay-300"
                      strokeWidth={1.8}
                    />
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-semibold text-paper-50">
                      {pointTitle}
                    </span>
                    <span className="mt-0.5 block max-w-[34ch] text-[11.5px] leading-5 text-paper-200/65">
                      {copy}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative mt-10 border-t border-paper-50/10 pt-4 text-[10.5px] leading-5 text-paper-200/45">
            TripSync records planning information only. It never moves money.
          </p>
        </aside>

        <main
          id="main"
          className="flex flex-1 flex-col px-5 pb-10 pt-6 sm:px-10 lg:px-14 lg:py-11"
        >
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex rounded-md lg:hidden"
              aria-label="TripSync home"
            >
              <Logo />
            </Link>
            <Link
              href="/"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md text-[11.5px] font-medium text-ink-500 transition-colors hover:text-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              Back to home
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[404px] flex-1 flex-col justify-center py-10">
            <header>
              <p className="eyebrow">Your account</p>
              <h1 className="mt-2 font-display text-[27px] font-semibold leading-[1.2] tracking-[-0.02em] text-forest-900">
                {title}
              </h1>
              <p className="mt-2 text-[12.5px] leading-6 text-ink-500">
                {description}
              </p>
            </header>

            <div className="mt-6">{children}</div>

            {footer && (
              <div className="mt-6 border-t border-line pt-4 text-[12px] leading-5 text-ink-500">
                {footer}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
