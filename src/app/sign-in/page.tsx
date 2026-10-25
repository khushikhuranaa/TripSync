import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSessionUser, isVerificationEnforced } from "@/server/auth";
import { safeNextPath } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your TripSync account to plan trips with your group.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  // Already signed in? There is nothing to do on this screen.
  const user = await getSessionUser();
  if (user) redirect(next);

  const notice =
    params.notice === "reset"
      ? "reset"
      : params.notice === "signed-out"
        ? "signed-out"
        : undefined;

  return (
    <AuthShell
      title="Sign in to TripSync"
      description="Use the email and password you signed up with. Your session stays open on this device for 30 days."
      footer={
        <p>
          New to TripSync?{" "}
          <Link
            href={`/sign-up?next=${encodeURIComponent(next)}`}
            className="font-medium text-forest-800 underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <SignInForm
        next={next}
        notice={notice}
        verificationEnforced={isVerificationEnforced()}
      />
    </AuthShell>
  );
}
