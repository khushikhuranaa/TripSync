"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { authClient } from "@/lib/auth-client";
import {
  acceptInvitationTokenAction,
  declineInvitationTokenAction,
} from "@/server/actions";

/**
 * The accept/decline step of an invitation.
 *
 * Both choices call a server action that re-reads the invitation, checks that
 * the signed-in account is the invited email, and only then writes membership
 * and the invitation status in one D1 batch. Nothing here grants access by
 * itself.
 */
export function InvitationResponse({
  token,
  signedInEmail,
  allowResponse = true,
}: {
  token: string;
  signedInEmail?: string;
  /** False when the signed-in account is not the invited address. */
  allowResponse?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function accept() {
    if (pending) return;
    setPending("accept");
    setError(null);
    const result = await acceptInvitationTokenAction(token);
    if (result.ok) {
      router.push(`/preview/trips/${result.createdTripId ?? ""}`);
      router.refresh();
      return;
    }
    setPending(null);
    setError(result.error);
  }

  async function decline() {
    if (pending) return;
    setPending("decline");
    setError(null);
    const result = await declineInvitationTokenAction(token);
    setPending(null);
    if (result.ok) {
      setDeclined(true);
      router.refresh();
      return;
    }
    setError(result.error);
  }

  async function switchAccount() {
    if (switching) return;
    setSwitching(true);
    await authClient.signOut().catch(() => undefined);
    router.refresh();
    setSwitching(false);
  }

  if (declined) {
    return (
      <InlineNotice variant="info" title="Invitation declined">
        Nothing was added to your workspace and no access was granted. The trip
        owner has been notified, and they can invite you again later.
      </InlineNotice>
    );
  }

  if (!allowResponse) {
    return (
      <button
        type="button"
        onClick={switchAccount}
        disabled={switching}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-forest-800 underline-offset-2 hover:underline disabled:opacity-60"
      >
        <LogOut aria-hidden="true" className="size-3.5" />
        {switching ? "Signing out…" : "Sign out and use the invited address"}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <InlineNotice variant="warning" title="That didn't work">
          {error}
        </InlineNotice>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          disabled={pending !== null}
          onClick={accept}
        >
          <Check aria-hidden="true" className="size-4" />
          {pending === "accept" ? "Joining…" : "Accept invitation"}
        </Button>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={pending !== null}
          onClick={decline}
        >
          <X aria-hidden="true" className="size-4" />
          {pending === "decline" ? "Declining…" : "Decline"}
        </Button>
      </div>

      {signedInEmail && (
        <button
          type="button"
          onClick={switchAccount}
          disabled={switching}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500 underline-offset-2 hover:text-forest-800 hover:underline disabled:opacity-60"
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          {switching ? "Signing out…" : `Not ${signedInEmail}? Sign out`}
        </button>
      )}
    </div>
  );
}
