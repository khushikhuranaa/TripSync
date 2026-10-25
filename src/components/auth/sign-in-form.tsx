"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { PasswordField } from "@/components/auth/password-field";
import { GoogleButton } from "@/components/auth/google-button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/session";

type Errors = { email?: string; password?: string; code?: string };

export function SignInForm({
  next,
  notice,
  verificationEnforced,
  googleConfigured,
}: {
  next: string;
  notice?: "reset" | "signed-out";
  /** True only when this deployment can send mail, so the hint is accurate. */
  verificationEnforced?: boolean;
  /** True only when Google OAuth credentials exist; gates the Google button. */
  googleConfigured?: boolean;
}) {
  const router = useRouter();
  const destination = safeNextPath(next);
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [unverified, setUnverified] = useState(false);

  // Second step: only rendered when the server says a factor is still required.
  const [challenge, setChallenge] = useState<null | "totp" | "backup">(null);
  const [code, setCode] = useState("");
  const [challengeError, setChallengeError] = useState<string | undefined>();
  const [challengePending, setChallengePending] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    if (formError) setFormError(undefined);
    if (unverified) setUnverified(false);
  }

  function validate() {
    const nextErrors: Errors = {};
    const email = values.email.trim();
    if (!email) nextErrors.email = "Enter the email you signed up with.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter an email address in the form name@example.com.";
    }
    if (!values.password) nextErrors.password = "Enter your password.";
    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setFormError(undefined);
    const { data, error } = await authClient.signIn.email({
      email: values.email.trim(),
      password: values.password,
    });
    setPending(false);

    if (error) {
      const text = authErrorMessage(
        error,
        "We could not sign you in. Check your details and try again.",
      );
      setUnverified(
        error.code === "EMAIL_NOT_VERIFIED" ||
          /verif/i.test(error.message ?? ""),
      );
      setFormError(text);
      return;
    }

    // Password accepted, but the account has a second factor: no session yet.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setChallenge("totp");
      setCode("");
      return;
    }

    // The session cookie is set by the server response, so the destination
    // loads as a signed-in request.
    router.replace(destination);
    router.refresh();
  }

  async function handleChallenge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.replace(/\s+/g, "");
    if (!trimmed) {
      setChallengeError(
        challenge === "backup"
          ? "Enter one of your recovery codes."
          : "Enter the 6-digit code from your authenticator app.",
      );
      return;
    }

    setChallengePending(true);
    setChallengeError(undefined);
    const { error } =
      challenge === "backup"
        ? await authClient.twoFactor.verifyBackupCode({ code: trimmed })
        : await authClient.twoFactor.verifyTotp({ code: trimmed });
    setChallengePending(false);

    if (error) {
      setChallengeError(
        authErrorMessage(
          error,
          "That code is not correct. Try the next one your app generates.",
        ),
      );
      setCode("");
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  if (challenge) {
    return (
      <form onSubmit={handleChallenge} noValidate className="space-y-4">
        <InlineNotice variant="info" title="Two-factor authentication">
          {challenge === "backup"
            ? "Enter one of the recovery codes you saved when you set up two-factor authentication. Each code works once."
            : "Open your authenticator app and enter the current 6-digit code for TripSync."}
        </InlineNotice>

        {challengeError && (
          <p
            role="alert"
            className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
          >
            {challengeError}
          </p>
        )}

        <Field
          id="sign-in-code"
          label={challenge === "backup" ? "Recovery code" : "Authentication code"}
          error={errors.code}
        >
          <Input
            id="sign-in-code"
            inputMode={challenge === "backup" ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            placeholder={challenge === "backup" ? "abcd-efgh-ij" : "123456"}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setChallengeError(undefined);
            }}
          />
        </Field>

        <Button type="submit" size="md" className="w-full" disabled={challengePending}>
          {challengePending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ShieldCheck aria-hidden="true" className="size-4" />
          )}
          {challengePending ? "Checking…" : "Verify and continue"}
        </Button>

        <div className="flex items-center justify-between text-[11.5px]">
          <button
            type="button"
            onClick={() => {
              setChallenge(challenge === "backup" ? "totp" : "backup");
              setCode("");
              setChallengeError(undefined);
            }}
            className="inline-flex items-center gap-1.5 rounded-sm font-medium text-forest-800 underline-offset-2 hover:underline"
          >
            <KeyRound aria-hidden="true" className="size-3.5" />
            {challenge === "backup"
              ? "Use my authenticator app"
              : "Use a recovery code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setChallengeError(undefined);
            }}
            className="rounded-sm text-forest-800 underline-offset-2 hover:underline"
          >
            Start over
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {notice === "reset" && (
        <InlineNotice variant="success" title="Password updated">
          Sign in with your new password to continue.
        </InlineNotice>
      )}
      {notice === "signed-out" && (
        <InlineNotice variant="info" title="You have been signed out">
          Your session ended. Sign in again to return to your trips.
        </InlineNotice>
      )}
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
        >
          {formError}
          {unverified && verificationEnforced && (
            <>
              {" "}
              <Link
                href={`/verify-email?email=${encodeURIComponent(values.email.trim())}`}
                className="font-medium underline underline-offset-2"
              >
                Resend the confirmation link
              </Link>
              .
            </>
          )}
        </p>
      )}

      {googleConfigured && (
        <>
          <GoogleButton destination={destination} />
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-clay-200" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
              or
            </span>
            <span className="h-px flex-1 bg-clay-200" />
          </div>
        </>
      )}

      <Field id="sign-in-email" label="Email" error={errors.email}>
        <Input
          id="sign-in-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "sign-in-email-error" : undefined}
        />
      </Field>

      <div>
        <PasswordField
          id="sign-in-password"
          label="Password"
          value={values.password}
          onChange={(value) => update("password", value)}
          error={errors.password}
          autoComplete="current-password"
          placeholder="Your password"
        />
        <div className="mt-1.5 text-right">
          <Link
            href={`/forgot-password?next=${encodeURIComponent(destination)}`}
            className="rounded-sm text-[11.5px] font-medium text-forest-800 underline-offset-2 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <LogIn aria-hidden="true" className="size-4" />
        )}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
