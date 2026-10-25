import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { InlineNotice } from "@/components/ui/feedback";
import { getSessionUser, isVerificationEnforced } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Confirm the email address on your TripSync account.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Landing page for confirmation links.
 *
 * The link itself is handled by `/api/auth/verify-email`, which consumes the
 * token and redirects here with `?confirmed=1`. Nothing on this page inspects
 * or echoes the token, so a leaked URL cannot be replayed from the browser.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const confirmed = first(params.confirmed) === "1";
  const user = await getSessionUser();
  const enforced = isVerificationEnforced();
  const email = user?.email ?? first(params.email) ?? "";

  return (
    <AuthShell
      title={confirmed ? "Email confirmed" : "Confirm your email"}
      description={
        confirmed
          ? "Your address is verified. You can carry on planning."
          : "Confirmation links expire after one hour and work once. If yours has been used or has run out, ask for a new one."
      }
      footer={
        <p>
          {confirmed ? (
            <Link
              href="/preview/dashboard"
              className="font-medium text-forest-800 underline-offset-2 hover:underline"
            >
              Go to your trips
            </Link>
          ) : (
            <>
              Already confirmed?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-forest-800 underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      }
    >
      <div className="space-y-4">
        {confirmed && (
          <InlineNotice variant="success" title="Address verified">
            Signing in again will not ask you to confirm this address.
          </InlineNotice>
        )}
        {!confirmed && user && !user.emailVerified && enforced && (
          <InlineNotice variant="info" title="One step left">
            Confirm this address to open your trips. Until then the workspace
            stays locked.
          </InlineNotice>
        )}
        <VerifyEmailPanel email={email} verificationEnforced={enforced} />
      </div>
    </AuthShell>
  );
}
