import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { SessionProvider } from "@/components/app-shell/session-provider";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import { PreviewProvider } from "@/components/preview/preview-provider";
import { DemoProvider } from "@/lib/demo-store";
import { initialsFor, toneForId } from "@/lib/identity";
import type { SessionProfile } from "@/lib/session";
import { getSessionUser, isVerificationEnforced } from "@/server/auth";
import { loadWorkspace } from "@/server/data";

/**
 * The workspace is a protected route group: the session is checked here, on the
 * server, before any page markup is produced. Redirecting rather than hiding
 * navigation links is what actually keeps the pages private.
 *
 * The signed-in user's workspace — trips, itinerary, expenses, polls, packing,
 * notes and invitations — is loaded from D1 here and passed to `DemoProvider`,
 * so every page starts from real records scoped to this account.
 */
export const dynamic = "force-dynamic";

export default async function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const headerList = await headers();
  const requestedPath = headerList.get("x-pathname") ?? "/preview/dashboard";

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(requestedPath)}`);
  }

  // An unconfirmed address keeps the workspace closed — but only when mail can
  // actually be delivered, otherwise nobody could ever get in.
  if (isVerificationEnforced() && !user.emailVerified) {
    redirect("/verify-email");
  }

  const profile: SessionProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: initialsFor(user.name),
    tone: toneForId(user.id),
    platformRole: user.role,
    homeCity: user.homeCity,
    travelStyle: user.travelStyle,
    dietaryNotes: user.dietaryNotes,
    joinedAt: new Date(user.createdAt).toISOString().slice(0, 10),
  };

  const workspace = await loadWorkspace(user.id);

  return (
    <SessionProvider profile={profile}>
      <DemoProvider initialState={workspace}>
        <PreviewProvider>
          <div className="min-h-dvh bg-paper-50">
            <Sidebar />
            <div className="lg:pl-[264px]">
              <TopBar />
              <main
                id="main"
                className="page-container pb-28 pt-6 sm:pt-8 lg:pb-14"
              >
                {children}
              </main>
            </div>
            <MobileNav />
          </div>
        </PreviewProvider>
      </DemoProvider>
    </SessionProvider>
  );
}
