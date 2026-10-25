import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper-50/95 backdrop-blur-sm">
      <div className="page-container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500"
          aria-label="TripSync home"
        >
          <Logo subtitle="Travel planning" />
        </Link>

        <nav aria-label="Landing" className="hidden items-center gap-8 lg:flex">
          <a
            href="#product"
            className="text-[13px] font-medium text-ink-700 transition-colors hover:text-forest-900"
          >
            Product
          </a>
          <a
            href="#ai-planner"
            className="text-[13px] font-medium text-ink-700 transition-colors hover:text-forest-900"
          >
            AI planner
          </a>
          <a
            href="#how-it-works"
            className="text-[13px] font-medium text-ink-700 transition-colors hover:text-forest-900"
          >
            How it works
          </a>
        </nav>

        <Link
          href="/sign-in"
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          Sign in
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </header>
  );
}
