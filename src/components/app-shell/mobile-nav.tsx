"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Mail, Map, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/preview/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/preview/trips", label: "Trips", icon: Map },
  { href: "/preview/invitations", label: "Invites", icon: Mail },
  { href: "/preview/profile", label: "Profile", icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workspace"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/preview/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 pb-1 pt-2.5 text-[10.5px] font-medium transition-colors",
                  active ? "text-clay-700" : "text-ink-500 hover:text-forest-800",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="size-[21px]"
                  strokeWidth={active ? 2 : 1.7}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
