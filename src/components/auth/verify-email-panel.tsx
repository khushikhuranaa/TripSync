"use client";

import { useState } from "react";
import { LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { authClient, authErrorMessage } from "@/lib/auth-client";

/**
 * Resends a confirmation link.
 *
 * The server allows three sends per five minutes per address, so the button is
 * not a way to spam an inbox; a rejected send shows the rate-limit sentence
 * instead of a false "sent" message.
 */
export function VerifyEmailPanel({
  email: initialEmail,
  verificationEnforced,
}: {
  email: string;
  verificationEnforced: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!verificationEnforced) {
    return (
      <InlineNotice variant="info" title="Email delivery is not configured">
        This deployment has no email provider, so address confirmation is
        switched off and new accounts work without it. Add{" "}
        <code className="font-mono text-[11.5px]">RESEND_API_KEY</code> and{" "}
        <code className="font-mono text-[11.5px]">EMAIL_FROM</code> as server
        secrets to turn confirmation links on.
      </InlineNotice>
    );
  }

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter the email you signed up with.");
      return;
    }
    setPending(true);
    setError(undefined);
    setSent(false);
    const { error: failure } = await authClient.sendVerificationEmail({
      email: email.trim(),
      callbackURL: "/verify-email?confirmed=1",
    });
    setPending(false);
    if (failure) {
      setError(
        authErrorMessage(
          failure,
          "The message could not be sent. Try again in a few minutes.",
        ),
      );
      return;
    }
    setSent(true);
  }

  return (
    <form onSubmit={resend} noValidate className="space-y-4">
      {sent && (
        <InlineNotice variant="success" title="New link sent">
          If that address has an account waiting for confirmation, a fresh link
          is on its way. It expires in one hour.
        </InlineNotice>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
        >
          {error}
        </p>
      )}

      <Field id="verify-email" label="Email">
        <Input
          id="verify-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(undefined);
            setSent(false);
          }}
        />
      </Field>

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <MailCheck aria-hidden="true" className="size-4" />
        )}
        {pending ? "Sending…" : "Resend confirmation link"}
      </Button>
    </form>
  );
}
