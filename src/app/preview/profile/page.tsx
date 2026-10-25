import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/profile/profile-form";
import { AccountSecurity } from "@/components/profile/account-security";
import {
  NotificationPreferencesForm,
  TourSettings,
} from "@/components/profile/account-preferences";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/server/auth";
import { loadWorkspace } from "@/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=%2Fpreview%2Fprofile");

  const workspace = await loadWorkspace(user.id);
  const profile = workspace.profile;
  const myTrips = workspace.trips.filter((trip) =>
    trip.members.some((member) => member.id === profile.id),
  );
  const owned = myTrips.filter((trip) => trip.ownerId === profile.id).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="The details your trip groups see, plus the defaults used when you start planning."
      />

      <div className="grid gap-5 lg:grid-cols-[290px_1fr] lg:items-start">
        <aside className="card-surface overflow-hidden">
          <div className="h-20 bg-[linear-gradient(105deg,#e5ecdd_0%,#f5efe3_55%,#f6e1d5_100%)]" />
          <div className="-mt-8 px-5 pb-5">
            <Avatar member={profile} size="xl" className="ring-4 ring-card" />
            <h2 className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em] text-forest-900">
              {profile.name}
            </h2>
            <p className="mt-0.5 break-words text-[12px] text-ink-500">
              {profile.email}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.platformRole === "admin" ? (
                <Badge variant="sage">
                  <ShieldCheck aria-hidden="true" className="size-3" />
                  Platform admin
                </Badge>
              ) : (
                <Badge variant="outline">Traveller</Badge>
              )}
              {user.emailVerified ? (
                <Badge variant="sage">
                  <ShieldCheck aria-hidden="true" className="size-3" />
                  Email verified
                </Badge>
              ) : (
                <Badge variant="outline">Email not verified</Badge>
              )}
            </div>

            <dl className="mt-5 space-y-3 border-t border-line pt-4 text-[12px]">
              <div className="flex items-start gap-2.5">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-ink-400"
                />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                    Home city
                  </dt>
                  <dd className="mt-0.5 font-medium text-forest-900">
                    {profile.homeCity || "Not set"}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-ink-400"
                />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                    Member since
                  </dt>
                  <dd className="mt-0.5 font-medium text-forest-900">
                    {formatDate(profile.joinedAt)}
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-5 rounded-lg border border-line bg-paper-50 px-3 py-2.5">
              <p className="text-[11px] text-ink-500">
                {myTrips.length === 0 ? (
                  "You have not joined a trip yet."
                ) : (
                  <>
                    You own{" "}
                    <span className="font-semibold text-forest-900">{owned}</span> of{" "}
                    {myTrips.length}{" "}
                    {myTrips.length === 1 ? "trip" : "trips"} you belong to.
                  </>
                )}
              </p>
              <Link
                href="/preview/trips"
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-forest-800 hover:text-clay-700"
              >
                Open my trips
                <ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <ProfileForm profile={profile} />

          <NotificationPreferencesForm profile={profile} />

          <TourSettings onboardingCompletedAt={profile.onboardingCompletedAt} />

          <AccountSecurity
            email={profile.email}
            name={profile.name}
            twoFactorEnabled={Boolean(user.twoFactorEnabled)}
          />

          <p className="text-[11px] leading-5 text-ink-400">
            Profile changes are saved to your account and appear on every device
            you sign in from.
          </p>
        </div>
      </div>
    </div>
  );
}
