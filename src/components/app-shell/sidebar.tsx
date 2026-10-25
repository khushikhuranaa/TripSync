"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  Map,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useSessionProfile } from "@/components/app-shell/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { useDemoStore } from "@/lib/demo-store";

const primaryNav = [
  { href: "/preview/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/preview/trips", label: "My trips", icon: Map },
  { href: "/preview/invitations", label: "Invitations", icon: Mail },
  { href: "/preview/profile", label: "Profile", icon: UserRound },
];

export function Sidebar() {
  const pathname = usePathname();
  const session = useSessionProfile();
  const { state } = useDemoStore();
  // The signed-in account is real; the trip content behind it is still sample.
  const profile = session ?? state.profile;
  const pendingInvitations = state.invitations.filter(
    (invitation) =>
      invitation.kind === "received" && invitation.status === "pending",
  ).length;

  function isActive(href: string) {
    if (href === "/preview/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-forest-950/40 bg-forest-900 text-paper-50 lg:flex">
      <div className="px-6 pb-8 pt-7">
        <Link
          href="/preview/dashboard"
          className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper-50"
        >
          <Logo tone="light" subtitle="Travel planning" />
        </Link>
      </div>

      <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-paper-200/50">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-paper-50/10 text-paper-50"
                      : "text-paper-200/75 hover:bg-paper-50/[0.06] hover:text-paper-50",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-clay-500"
                    />
                  )}
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "size-[18px] shrink-0",
                      active ? "text-paper-50" : "text-paper-200/60",
                    )}
                    strokeWidth={1.8}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/preview/invitations" && pendingInvitations > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-clay-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {pendingInvitations}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {profile.platformRole === "admin" && (
          <>
            <p className="mt-7 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-paper-200/50">
              Platform
            </p>
            <Link
              href="/preview/admin"
              aria-current={isActive("/preview/admin") ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                isActive("/preview/admin")
                  ? "bg-paper-50/10 text-paper-50"
                  : "text-paper-200/75 hover:bg-paper-50/[0.06] hover:text-paper-50",
              )}
            >
              {isActive("/preview/admin") && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-clay-500"
                />
              )}
              <ShieldCheck
                aria-hidden="true"
                className="size-[18px] shrink-0 text-paper-200/60"
                strokeWidth={1.8}
              />
              Admin
            </Link>
          </>
        )}
      </nav>

      <div className="space-y-3 px-4 pb-5 pt-4">
        <Link
          href="/preview/profile"
          className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-paper-50/[0.06]"
        >
          <Avatar member={profile} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-paper-50">
              {profile.name}
            </span>
            <span className="block truncate text-[10.5px] text-paper-200/60">
              {profile.email}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
