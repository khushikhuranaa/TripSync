import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const links = [
  { label: "Product preview", href: "/preview/dashboard" },
  { label: "Sample itinerary", href: "/preview/trips/goa/itinerary" },
  { label: "Photo credits", href: "/credits" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-100/55">
      <div className="page-container py-10 sm:py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Logo subtitle="Travel planning" />
            <p className="mt-3 text-[12.5px] leading-5 text-ink-500">
              A collaborative trip planner for people who would rather be
              planning the trip than scrolling through group chats to find the
              plan.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2.5 sm:gap-x-16">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[12.5px] text-ink-500 transition-colors hover:text-forest-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-line pt-5 text-[11.5px] text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Trips saved to your account · works across devices.</p>
        </div>
      </div>
    </footer>
  );
}
