import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Complete a TripSync password reset.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = typeof rawToken === "string" && rawToken.length > 0 ? rawToken : undefined;

  return (
    <AuthShell
      title="Choose a new password"
      description="Pick something you have not used elsewhere. The reset link can only be used once."
      footer={
        <p>
          Need a different link?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-forest-800 underline-offset-2 hover:underline"
          >
            Request another one
          </Link>
        </p>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
