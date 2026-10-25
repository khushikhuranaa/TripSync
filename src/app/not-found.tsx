import Link from "next/link";
import { Compass } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-paper-50">
      <SiteHeader />
      <main
        id="main"
        className="page-container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center"
      >
        <span className="inline-flex size-12 items-center justify-center rounded-full border border-line bg-card text-forest-700">
          <Compass aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </span>
        <p className="eyebrow mt-5">Page not found</p>
        <h1 className="display-heading mt-2 text-[34px] text-forest-900">
          This route isn&apos;t on the map.
        </h1>
        <p className="mt-3 max-w-md text-[13px] leading-6 text-ink-500">
          The page may have moved, or the address may be incomplete. The product
          preview is a good place to pick the route back up.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/preview/dashboard"
            className={buttonStyles({ variant: "primary", size: "md" })}
          >
            Open the product preview
          </Link>
          <Link
            href="/"
            className={buttonStyles({ variant: "secondary", size: "md" })}
          >
            Back to the landing page
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
