"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordField } from "@/components/auth/password-field";
import { TwoFactorCard } from "@/components/profile/two-factor-card";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { changePasswordAction, deleteAccountAction } from "@/server/actions";

/** Account controls that talk to the server, not to local state. */
export function AccountSecurity({
  email,
  name,
  twoFactorEnabled,
}: {
  email: string;
  name: string;
  twoFactorEnabled: boolean;
}) {
  const router = useRouter();

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirm?: string;
  }>({});
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | undefined>();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: typeof passwordErrors = {};

    if (!passwords.currentPassword) {
      errors.currentPassword = "Enter your current password.";
    }
    if (!passwords.newPassword) errors.newPassword = "Choose a new password.";
    else if (passwords.newPassword.length < 8) {
      errors.newPassword = "Use at least 8 characters.";
    } else if (passwords.newPassword === passwords.currentPassword) {
      errors.newPassword = "Choose a password you have not used here before.";
    }
    if (!passwords.confirm) errors.confirm = "Repeat the new password.";
    else if (passwords.confirm !== passwords.newPassword) {
      errors.confirm = "The two passwords do not match.";
    }

    setPasswordErrors(errors);
    setPasswordSaved(false);
    setPasswordError(undefined);
    if (Object.keys(errors).length > 0) return;

    setChangingPassword(true);
    const result = await changePasswordAction({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
    setChangingPassword(false);

    if (!result.ok) {
      setPasswordError(result.error);
      return;
    }

    setPasswords({ currentPassword: "", newPassword: "", confirm: "" });
    setPasswordSaved(true);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(undefined);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      setSignOutError(
        authErrorMessage(error, "The session could not be ended. Try again."),
      );
      return;
    }
    router.push("/sign-in?notice=signed-out");
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(undefined);
    const result = await deleteAccountAction({ confirmEmail });
    if (!result.ok) {
      setDeleting(false);
      setDeleteError(result.error);
      return;
    }
    // The account row is gone, so the old cookie is no longer usable. Clearing
    // it client-side keeps the browser tidy if the server already dropped it.
    await authClient.signOut().catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="card-surface overflow-hidden">
        <div className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-100 text-forest-700">
            <KeyRound aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-forest-900">
              Password
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">
              Changing your password ends other signed-in sessions.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} noValidate className="space-y-4 px-4 py-5 sm:px-5">
          {passwordSaved && (
            <InlineNotice variant="success" title="Password changed">
              Use the new password the next time you sign in.
            </InlineNotice>
          )}
          {passwordError && (
            <p
              role="alert"
              className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
            >
              {passwordError}
            </p>
          )}

          <PasswordField
            id="security-current"
            label="Current password"
            value={passwords.currentPassword}
            onChange={(value) =>
              setPasswords((current) => ({ ...current, currentPassword: value }))
            }
            error={passwordErrors.currentPassword}
            autoComplete="current-password"
            placeholder="Your current password"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="security-new"
              label="New password"
              hint="8 characters or more"
              value={passwords.newPassword}
              onChange={(value) =>
                setPasswords((current) => ({ ...current, newPassword: value }))
              }
              error={passwordErrors.newPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="security-confirm"
              label="Repeat new password"
              value={passwords.confirm}
              onChange={(value) =>
                setPasswords((current) => ({ ...current, confirm: value }))
              }
              error={passwordErrors.confirm}
              autoComplete="new-password"
              placeholder="Type it again"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={changingPassword}>
              {changingPassword ? (
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <ShieldCheck aria-hidden="true" className="size-3.5" />
              )}
              {changingPassword ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </section>

      <TwoFactorCard enabled={twoFactorEnabled} />

      <section className="card-surface overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-[14px] font-semibold text-forest-900">
            This device
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-5 text-ink-500">
            Signed in as {name} ({email}). Sessions last 30 days and end when you
            sign out.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[11.5px] leading-5 text-ink-400">
            Signing out removes this browser&apos;s session. You will need your
            password to sign in again.
          </p>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <LogOut aria-hidden="true" className="size-3.5" />
              )}
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
            {signOutError && (
              <p role="alert" className="text-[11px] text-clay-700">
                {signOutError}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-clay-200 bg-clay-50/40 p-4 sm:p-5">
        <h2 className="text-[13.5px] font-semibold text-clay-700">
          Delete this account
        </h2>
        <p className="mt-1 max-w-xl text-[11.5px] leading-5 text-ink-500">
          Deleting your account removes your profile, the trips you own with all
          their itinerary, expenses, polls, packing lists and notes, and your
          membership of other people&apos;s trips. This cannot be undone.
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={() => {
            setConfirmEmail("");
            setDeleteError(undefined);
            setDeleteOpen(true);
          }}
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
          Delete account
        </Button>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your TripSync account?</DialogTitle>
            <DialogDescription>
              This is permanent. Trips you own are deleted with their plan and
              records; trips you joined stay with their owners.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-clay-200 bg-clay-50 px-3.5 py-3 text-[11.5px] leading-5 text-clay-700">
            Your profile, memberships and invitations are removed immediately,
            and anything you contributed to trips you joined — activities, notes,
            polls and expenses you added — is removed with you. There is no
            recovery period.
          </div>

          <Field
            id="delete-confirm-email"
            label="Type your email to confirm"
            error={deleteError}
          >
            <Input
              id="delete-confirm-email"
              type="email"
              autoComplete="off"
              placeholder={email}
              value={confirmEmail}
              onChange={(event) => {
                setConfirmEmail(event.target.value);
                if (deleteError) setDeleteError(undefined);
              }}
              aria-invalid={Boolean(deleteError)}
              aria-describedby={deleteError ? "delete-confirm-email-error" : undefined}
            />
          </Field>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={
                deleting ||
                confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()
              }
            >
              {deleting ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="size-4" />
              )}
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
