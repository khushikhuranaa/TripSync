import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getSessionUser } from "@/server/auth";
import { isEmailConfigured } from "@/server/email";
import { safeNextPath } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your TripSync account.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  const user = await getSessionUser();
  if (user) {
    // Signed-in people can change the password from their profile instead.
    return (
      <AuthShell
        title="You are already signed in"
        description="Change your password from your profile, where the current password is required."
      >
        <div className="space-y-3">
          <Link
            href="/preview/profile"
            className="inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-forest-900 bg-forest-900 px-4 text-sm font-medium text-paper-50 transition-colors hover:bg-forest-800"
          >
            Open your profile
          </Link>
          <Link
            href={next}
            className="inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-line-strong bg-card px-4 text-sm font-medium text-forest-900 transition-colors hover:bg-paper-100"
          >
            Back to TripSync
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email on your account and we will send a link to choose a new password."
      footer={
        <p>
          Remembered it?{" "}
          <Link
            href={`/sign-in?next=${encodeURIComponent(next)}`}
            className="font-medium text-forest-800 underline-offset-2 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm emailConfigured={isEmailConfigured()} next={next} />
    </AuthShell>
  );
}
