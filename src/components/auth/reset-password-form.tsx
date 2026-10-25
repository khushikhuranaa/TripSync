"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { PasswordField } from "@/components/auth/password-field";
import { authClient, authErrorMessage } from "@/lib/auth-client";

type Errors = { password?: string; confirm?: string };

/**
 * Completes a reset link.
 *
 * The token comes from the URL, but the server is what validates it: expired or
 * already-used tokens are rejected by Better Auth, not by this component.
 */
export function ResetPasswordForm({ token }: { token?: string }) {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    if (formError) setFormError(undefined);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const nextErrors: Errors = {};
    if (!values.password) nextErrors.password = "Choose a new password.";
    else if (values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    } else if (values.password.length > 128) {
      nextErrors.password = "Keep the password under 128 characters.";
    }
    if (!values.confirm) nextErrors.confirm = "Repeat the new password.";
    else if (values.confirm !== values.password) {
      nextErrors.confirm = "The two passwords do not match.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setFormError(undefined);
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });
    setPending(false);

    if (error) {
      setFormError(
        authErrorMessage(
          error,
          "The password could not be changed. The link may have expired.",
        ),
      );
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <InlineNotice variant="danger" title="This reset link is incomplete">
          The address is missing its reset token. Open the link from your email
          again, or request a new one.
        </InlineNotice>
        <Link
          href="/forgot-password"
          className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <InlineNotice variant="success" title="Password changed">
          The new password is active now. Sign in to continue planning.
        </InlineNotice>
        <Link
          href="/sign-in?notice=reset"
          className={buttonStyles({ size: "md", className: "w-full" })}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <div role="alert">
          <InlineNotice variant="danger" title="That link did not work">
            {formError}{" "}
            <Link
              href="/forgot-password"
              className="font-medium underline underline-offset-2"
            >
              Request a new link
            </Link>
            .
          </InlineNotice>
        </div>
      )}

      <PasswordField
        id="reset-password"
        label="New password"
        hint="8 characters or more"
        value={values.password}
        onChange={(value) => update("password", value)}
        error={errors.password}
        autoComplete="new-password"
      />

      <PasswordField
        id="reset-confirm"
        label="Repeat new password"
        value={values.confirm}
        onChange={(value) => update("confirm", value)}
        error={errors.confirm}
        autoComplete="new-password"
        placeholder="Type it again"
      />

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <KeyRound aria-hidden="true" className="size-4" />
        )}
        {pending ? "Updating the password…" : "Set new password"}
      </Button>
    </form>
  );
}
