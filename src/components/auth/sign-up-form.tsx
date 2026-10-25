"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MailCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { PasswordField } from "@/components/auth/password-field";
import { GoogleButton } from "@/components/auth/google-button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/session";

type Values = {
  name: string;
  email: string;
  password: string;
  confirm: string;
};

type Errors = Partial<Record<keyof Values, string>>;

export function SignUpForm({
  next,
  verificationEnforced,
  googleConfigured,
}: {
  next: string;
  /** True only when this deployment can send mail; decides the next screen. */
  verificationEnforced?: boolean;
  /** True only when Google OAuth credentials exist; gates the Google button. */
  googleConfigured?: boolean;
}) {
  const router = useRouter();
  const destination = safeNextPath(next);
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  // Set when the account exists but the address still needs confirming.
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  function update(key: keyof Values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    if (formError) setFormError(undefined);
  }

  function validate(): Errors {
    const nextErrors: Errors = {};
    const name = values.name.trim();
    const email = values.email.trim();

    if (!name) nextErrors.name = "Add the name your group will recognise.";
    else if (name.length < 2) nextErrors.name = "Use at least 2 characters.";
    else if (name.length > 80) nextErrors.name = "Keep the name under 80 characters.";

    if (!email) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter an email address in the form name@example.com.";
    }

    if (!values.password) nextErrors.password = "Choose a password.";
    else if (values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    } else if (values.password.length > 128) {
      nextErrors.password = "Keep the password under 128 characters.";
    }

    if (!values.confirm) nextErrors.confirm = "Repeat the password.";
    else if (values.confirm !== values.password) {
      nextErrors.confirm = "The two passwords do not match.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setFormError(undefined);
    const { data, error } = await authClient.signUp.email({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    });
    setPending(false);

    if (error) {
      setFormError(
        authErrorMessage(
          error,
          "The account could not be created. Check the details and try again.",
        ),
      );
      return;
    }

    // With mail configured the address is still unconfirmed, and the server
    // refuses a session until it is confirmed, so show the next step instead
    // of sending the person to a page that will bounce them back.
    const unconfirmed =
      data && "user" in data && data.user && data.user.emailVerified === false;
    if (verificationEnforced && unconfirmed) {
      setAwaitingVerification(true);
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  if (awaitingVerification) {
    return (
      <div className="space-y-4">
        <InlineNotice variant="success" title="Check your inbox">
          A confirmation link is on its way to{" "}
          <span className="font-medium">{values.email.trim()}</span>. Open it to
          finish setting up your account, then sign in. The link expires in one
          hour and can be used once. If nothing arrives, the confirmation page
          will tell you whether delivery is failing.
        </InlineNotice>
        <Button
          type="button"
          size="md"
          variant="secondary"
          className="w-full"
          onClick={() =>
            router.replace(
              `/verify-email?email=${encodeURIComponent(values.email.trim())}`,
            )
          }
        >
          <MailCheck aria-hidden="true" className="size-4" />
          Resend or open the confirmation page
        </Button>
        <Button
          type="button"
          size="md"
          variant="ghost"
          className="w-full"
          onClick={() =>
            router.replace(`/sign-in?next=${encodeURIComponent(destination)}`)
          }
        >
          Go to sign in
        </Button>
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

      <Field id="sign-up-name" label="Your name" error={errors.name}>
        <Input
          id="sign-up-name"
          autoComplete="name"
          autoFocus
          placeholder="Khushi Khurana"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "sign-up-name-error" : undefined}
        />
      </Field>

      <Field id="sign-up-email" label="Email" error={errors.email}>
        <Input
          id="sign-up-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "sign-up-email-error" : undefined}
        />
      </Field>

      <PasswordField
        id="sign-up-password"
        label="Password"
        hint="8 characters or more"
        value={values.password}
        onChange={(value) => update("password", value)}
        error={errors.password}
        autoComplete="new-password"
      />

      <PasswordField
        id="sign-up-confirm"
        label="Repeat password"
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
          <UserPlus aria-hidden="true" className="size-4" />
        )}
        {pending ? "Creating your account…" : "Create account"}
      </Button>

      <p className="text-[11px] leading-5 text-ink-400">
        By creating an account you agree to keep other travellers&apos; details
        inside the trips you share. TripSync stores planning information only and
        never processes payments.
      </p>
    </form>
  );
}
