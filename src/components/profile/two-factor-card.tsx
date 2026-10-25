"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { InlineNotice } from "@/components/ui/feedback";
import { PasswordField } from "@/components/auth/password-field";
import { authClient, authErrorMessage } from "@/lib/auth-client";

/** Pulls the Base32 secret out of the otpauth:// URI for manual entry. */
function secretFrom(uri: string) {
  const match = /[?&]secret=([^&]+)/.exec(uri);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Authenticator-app two-factor enrolment.
 *
 * Enrolment only completes after a correct code is submitted, so a half-set-up
 * account can never lock itself out. Turning 2FA off, and minting fresh recovery
 * codes, both require the current password.
 */
export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [busy, setBusy] = useState<"enable" | "confirm" | "disable" | "codes" | null>(
    null,
  );
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  async function startEnrolment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError("Enter your current password to start setup.");
      return;
    }
    setBusy("enable");
    setError(undefined);
    setNotice(undefined);
    const { data, error: failure } = await authClient.twoFactor.enable({
      password,
      method: "totp",
    });
    setBusy(null);
    if (failure || !data) {
      setError(
        failure?.code === "INVALID_PASSWORD"
          ? "That password is not correct."
          : authErrorMessage(
              failure,
              "Two-factor setup could not start. Check your password and try again.",
            ),
      );
      return;
    }
    // The endpoint returns TOTP material for method "totp", the one we asked for.
    const totp = data as { totpURI?: string; backupCodes?: string[] };
    setTotpURI(totp.totpURI ?? null);
    setCodes(Array.isArray(totp.backupCodes) ? totp.backupCodes : []);
    setPassword("");
  }

  async function confirmEnrolment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.replace(/\s+/g, "");
    if (trimmed.length < 6) {
      setError("Enter the 6-digit code your app shows for TripSync.");
      return;
    }
    setBusy("confirm");
    setError(undefined);
    const { error: failure } = await authClient.twoFactor.verifyTotp({
      code: trimmed,
    });
    setBusy(null);
    if (failure) {
      setError(
        authErrorMessage(
          failure,
          "That code was not accepted. Codes change every 30 seconds — try the current one.",
        ),
      );
      return;
    }
    setTotpURI(null);
    setNotice(
      "Two-factor authentication is on. You will be asked for a code the next time you sign in.",
    );
    setCode("");
    router.refresh();
  }

  async function disable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError("Enter your current password to turn two-factor off.");
      return;
    }
    setBusy("disable");
    setError(undefined);
    const { error: failure } = await authClient.twoFactor.disable({ password });
    setBusy(null);
    if (failure) {
      setError(
        failure.code === "INVALID_PASSWORD"
          ? "That password is not correct."
          : authErrorMessage(
              failure,
              "Two-factor authentication could not be turned off. Check your password.",
            ),
      );
      return;
    }
    setPassword("");
    setConfirmingDisable(false);
    setCodes([]);
    setNotice("Two-factor authentication is off. Your old recovery codes no longer work.");
    router.refresh();
  }

  async function regenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError("Enter your current password to see new recovery codes.");
      return;
    }
    setBusy("codes");
    setError(undefined);
    const { data, error: failure } = await authClient.twoFactor.generateBackupCodes({
      password,
    });
    setBusy(null);
    if (failure || !data) {
      setError(
        failure?.code === "INVALID_PASSWORD"
          ? "That password is not correct."
          : authErrorMessage(failure, "New recovery codes could not be created."),
      );
      return;
    }
    setCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
    setPassword("");
    setNotice("New recovery codes created. The previous ones no longer work.");
  }

  const secret = totpURI ? secretFrom(totpURI) : "";

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-5">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-100 text-forest-700">
          {enabled ? (
            <ShieldCheck aria-hidden="true" className="size-4" strokeWidth={1.8} />
          ) : (
            <ShieldOff aria-hidden="true" className="size-4" strokeWidth={1.8} />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-forest-900">
              Two-factor authentication
            </h2>
            <Badge variant={enabled ? "sage" : "outline"}>
              {enabled ? "On" : "Off"}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">
            An authenticator app adds a second step after your password. Recovery
            codes let you back in if you lose the device.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        {notice && (
          <InlineNotice variant="success" title="Saved">
            {notice}
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

        {totpURI ? (
          <div className="space-y-4">
            <InlineNotice variant="info" title="Add TripSync to your app">
              Open your authenticator app and add an account using the key below.
              Choose time-based (TOTP) if it asks.
            </InlineNotice>

            <div className="rounded-lg border border-line bg-paper-50 px-3.5 py-3">
              <p className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
                Setup key
              </p>
              <p className="mt-1 select-all break-all font-mono text-[12.5px] leading-5 text-forest-900">
                {secret || totpURI}
              </p>
            </div>

            {codes.length > 0 && (
              <div className="rounded-lg border border-paper-300 bg-paper-100/70 px-3.5 py-3">
                <p className="text-[11.5px] font-semibold text-forest-900">
                  Save these recovery codes now
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-ink-500">
                  Each works once. They are not shown again after you leave this
                  page.
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px] text-forest-900">
                  {codes.map((entry) => (
                    <li key={entry} className="select-all">
                      {entry}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={confirmEnrolment} noValidate className="space-y-3">
              <Field id="totp-confirm" label="Code from your app">
                <Input
                  id="totp-confirm"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError(undefined);
                  }}
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTotpURI(null);
                    setCodes([]);
                    setCode("");
                    setError(undefined);
                  }}
                  disabled={busy === "confirm"}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={busy === "confirm"}>
                  {busy === "confirm" ? (
                    <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck aria-hidden="true" className="size-3.5" />
                  )}
                  {busy === "confirm" ? "Verifying…" : "Turn on two-factor"}
                </Button>
              </div>
            </form>
          </div>
        ) : enabled ? (
          <div className="space-y-4">
            {confirmingDisable ? (
              <form onSubmit={disable} noValidate className="space-y-3">
                <PasswordField
                  id="disable-2fa-password"
                  label="Current password"
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    setError(undefined);
                  }}
                  autoComplete="current-password"
                  placeholder="Confirm it is you"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmingDisable(false);
                      setPassword("");
                      setError(undefined);
                    }}
                    disabled={busy === "disable"}
                  >
                    Keep it on
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    disabled={busy === "disable"}
                  >
                    {busy === "disable" ? (
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldOff aria-hidden="true" className="size-3.5" />
                    )}
                    {busy === "disable" ? "Turning off…" : "Turn off two-factor"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setConfirmingDisable(true);
                    setPassword("");
                    setError(undefined);
                  }}
                >
                  <ShieldOff aria-hidden="true" className="size-3.5" />
                  Turn off
                </Button>
              </div>
            )}

            <form
              onSubmit={regenerate}
              noValidate
              className="space-y-3 border-t border-line pt-4"
            >
              <p className="text-[11.5px] leading-5 text-ink-500">
                Lost your recovery codes? Confirm your password to replace them.
              </p>
              <PasswordField
                id="regen-codes-password"
                label="Current password"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setError(undefined);
                }}
                autoComplete="current-password"
                placeholder="Your current password"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="secondary" disabled={busy === "codes"}>
                  {busy === "codes" ? (
                    <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck aria-hidden="true" className="size-3.5" />
                  )}
                  {busy === "codes" ? "Creating…" : "New recovery codes"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={startEnrolment} noValidate className="space-y-3">
            <PasswordField
              id="enable-2fa-password"
              label="Current password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                setError(undefined);
              }}
              autoComplete="current-password"
              placeholder="Confirm it is you"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy === "enable"}>
                {busy === "enable" ? (
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                )}
                {busy === "enable" ? "Preparing…" : "Set up two-factor"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
