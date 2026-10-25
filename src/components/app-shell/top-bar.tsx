"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CreateTripDialog } from "@/components/app-shell/create-trip-dialog";
import { AppBreadcrumb } from "@/components/app-shell/app-breadcrumb";
import { useSessionProfile } from "@/components/app-shell/session-provider";
import { UserMenu } from "@/components/app-shell/user-menu";
import { NotificationMenu } from "@/components/notifications/notification-menu";
import { useDemoStore } from "@/lib/demo-store";

export function TopBar() {
  const { state } = useDemoStore();
  const session = useSessionProfile();
  const profile = session ?? state.profile;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper-50/95 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/preview/dashboard"
            className="rounded-md lg:hidden"
            aria-label="TripSync dashboard"
          >
            <Logo />
          </Link>
          <div className="hidden lg:block">
            <AppBreadcrumb />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationMenu />
          <CreateTripDialog />
          <UserMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}
