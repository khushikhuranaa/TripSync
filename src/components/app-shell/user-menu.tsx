"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LoaderCircle,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { authClient } from "@/lib/auth-client";
import type { Profile } from "@/lib/types";

type MenuProfile = Pick<
  Profile,
  "name" | "email" | "initials" | "tone" | "platformRole"
>;

export function UserMenu({ profile }: { profile: MenuProfile }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSignOut() {
    setSigningOut(true);
    setError(undefined);

    const { error: signOutError } = await authClient.signOut();
    if (signOutError) {
      setSigningOut(false);
      setError(
        "The session could not be ended. Check your connection and try again.",
      );
      return;
    }

    // Trip data lives in the database, so signing out only ends the session:
    // the next person to sign in sees their own workspace, never this one's.
    router.push("/sign-in?notice=signed-out");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 rounded-full px-1.5 text-forest-900 hover:bg-paper-100"
          aria-label="Open account menu"
        >
          <Avatar member={profile} size="sm" />
          <span className="hidden max-w-28 truncate text-[12.5px] font-medium md:inline">
            {profile.name.split(" ")[0]}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="mr-1 hidden size-3.5 text-ink-500 md:block"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar member={profile} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-forest-900">
              {profile.name}
            </p>
            <p className="truncate text-[11.5px] text-ink-500">{profile.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-line" />

        <DropdownMenuItem asChild>
          <Link href="/preview/profile">
            <UserRound aria-hidden="true" className="size-4 text-ink-400" />
            Profile and preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/preview/invitations">
            <Mail aria-hidden="true" className="size-4 text-ink-400" />
            Invitations
          </Link>
        </DropdownMenuItem>
        {profile.platformRole === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/preview/admin">
              <ShieldCheck aria-hidden="true" className="size-4 text-ink-400" />
              Admin
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1 h-px bg-line" />
        {error && (
          <p
            role="alert"
            className="mx-2 mb-1 rounded-md border border-clay-200 bg-clay-50 px-2 py-1.5 text-[11px] leading-4 text-clay-700"
          >
            {error}
          </p>
        )}
        <DropdownMenuItem
          destructive
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          {signingOut ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <LogOut aria-hidden="true" className="size-4" />
          )}
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
