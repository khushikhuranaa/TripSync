"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle, MailCheck } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { authClient, authErrorMessage } from "@/lib/auth-client";

export function ForgotPasswordForm({
  emailConfigured,
  next,
}: {
  emailConfigured: boolean;
  next: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setError("Enter the email address on your account.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter an email address in the form name@example.com.");
      return;
    }

    setError(undefined);
    setFormError(undefined);
    setPending(true);
    const { error: requestError } = await authClient.requestPasswordReset({
      email: value,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);

    if (requestError) {
      setFormError(
        authErrorMessage(
          requestError,
          "The reset request could not be sent. Try again in a moment.",
        ),
      );
      return;
    }
    setSent(true);
  }

  if (!emailConfigured) {
    return (
      <div className="space-y-4">
        <InlineNotice variant="warning" title="Password email is not configured">
          This deployment cannot send email yet, so reset links cannot be
          delivered. An administrator needs to set <code>RESEND_API_KEY</code>{" "}
          and <code>EMAIL_FROM</code> as server secrets, then this screen works
          without further changes.
        </InlineNotice>
        <p className="text-[12px] leading-6 text-ink-500">
          If you still have access to your account, you can sign in and change the
          password from your profile once email is configured.
        </p>
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <InlineNotice variant="success" title="Check your inbox">
          If an account exists for {email.trim()}, a reset link is on its way. It
          expires in one hour.
        </InlineNotice>
        <p className="text-[12px] leading-6 text-ink-500">
          Nothing arrived? Check the spam folder, or{" "}
          <button
            type="button"
            className="font-medium text-forest-800 underline-offset-2 hover:underline"
            onClick={() => setSent(false)}
          >
            try a different email address
          </button>
          .
        </p>
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
        >
          {formError}
        </p>
      )}

      <Field id="forgot-email" label="Email" error={error}>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(undefined);
            if (formError) setFormError(undefined);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "forgot-email-error" : undefined}
        />
      </Field>

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <KeyRound aria-hidden="true" className="size-4" />
        )}
        {pending ? "Sending the link…" : "Send reset link"}
      </Button>

      <p className="flex items-start gap-2 text-[11px] leading-5 text-ink-400">
        <MailCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        For privacy, this screen does not reveal whether an email has an account.
      </p>
    </form>
  );
}
