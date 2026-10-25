import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getSessionUser, isGoogleConfigured, isVerificationEnforced } from "@/server/auth";
import { safeNextPath } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a TripSync account to plan trips with your group.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  const user = await getSessionUser();
  if (user) redirect(next);

  return (
    <AuthShell
      title="Create your account"
      description="One account holds every trip you own or join. Your group sees only the trips you share with them."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href={`/sign-in?next=${encodeURIComponent(next)}`}
            className="font-medium text-forest-800 underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <SignUpForm
        next={next}
        verificationEnforced={isVerificationEnforced()}
        googleConfigured={isGoogleConfigured()}
      />
    </AuthShell>
  );
}
