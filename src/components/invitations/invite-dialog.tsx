"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { useDemoStore } from "@/lib/demo-store";
import type { Trip } from "@/lib/types";

type Errors = { name?: string; email?: string };
type InviteRole = "editor" | "viewer";

export function InviteDialog({
  trip,
  trigger,
  triggerLabel = "Invite people",
  variant = "secondary",
  size = "md",
  className,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  trip: Trip;
  trigger?: ReactNode;
  triggerLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { state, sendInvitation } = useDemoStore();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("editor");
  const [errors, setErrors] = useState<Errors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // After a successful send, the newest pending invitation for that address is
  // in the workspace snapshot the server just returned; its link can be shared
  // right here when email delivery is not configured.
  const sentInvitation = sentTo
    ? state.invitations.find(
        (invitation) =>
          invitation.kind === "sent" &&
          invitation.tripId === trip.id &&
          invitation.status === "pending" &&
          invitation.inviteeEmail.toLowerCase() === sentTo,
      )
    : undefined;
  const inviteLink = sentInvitation?.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${sentInvitation.token}`
    : null;

  function resetForm() {
    setPending(false);
    setName("");
    setEmail("");
    setRole("editor");
    setErrors({});
    setSentTo(null);
    setCopied(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) resetForm();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    const cleanEmail = email.trim();

    if (!cleanEmail) next.email = "Add the person's email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail))
      next.email = "Enter a valid email address, for example name@example.com.";
    if (name.trim().length > 60) next.name = "Keep the name under 60 characters.";

    setErrors(next);
    if (Object.keys(next).length > 0 || pending) return;

    setPending(true);
    const created = await sendInvitation(trip.id, name, cleanEmail, role);
    setPending(false);
    if (created) setSentTo(cleanEmail.toLowerCase());
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant={variant} size={size} className={className}>
              <UserPlus aria-hidden="true" className="size-4" />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite someone to {trip.name}</DialogTitle>
          <DialogDescription>
            They will be able to see the itinerary, expenses, polls, packing list
            and notes for this trip only.
          </DialogDescription>
        </DialogHeader>

        <InlineNotice variant="info" title="Invitations grant access on acceptance">
          The invitation is stored against this trip and gives this person access
          only to this trip, once they accept. Registered members are notified in
          the app; an email is sent too when email delivery is configured.
          Invitations expire after 14 days.
        </InlineNotice>

        {sentTo ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-sage-300/70 bg-sage-100 px-3.5 py-3 text-[12px] leading-5 text-forest-800">
              Invitation saved for <strong>{sentTo}</strong>. It is pending until
              they accept, and their access only covers this trip.
            </div>
            {inviteLink ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
                  <Link2 aria-hidden="true" className="size-3.5" />
                  Shareable invitation link (expires in 14 days)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteLink}
                    aria-label="Invitation link"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-paper-50 px-2.5 text-[11.5px] text-ink-700"
                    onFocus={(event) => event.target.select()}
                  />
                  <Button variant="secondary" size="sm" onClick={copyLink}>
                    {copied ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Copy aria-hidden="true" className="size-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-[10.5px] leading-4 text-ink-400">
                  Email delivery is only used when RESEND_API_KEY and EMAIL_FROM
                  are configured on the server; until then share this link.
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <Field
            id="invite-name"
            label="Their name"
            optional
            error={errors.name}
          >
            <Input
              id="invite-name"
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="Sana Kapoor"
              autoComplete="off"
            />
          </Field>

          <Field id="invite-email" label="Email address" error={errors.email}>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
              }}
              placeholder="sana@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "invite-email-error" : undefined}
              autoComplete="off"
            />
          </Field>

          <Field id="invite-role" label="Their role"
            hint={role === "viewer" ? "Can read the trip and itinerary" : "Can change the itinerary"}>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as InviteRole)}
              className="h-9 w-full rounded-lg border border-line-strong bg-card px-2.5 text-[12.5px] text-ink-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
            >
              <option value="editor">Editor — can add and change activities</option>
              <option value="viewer">Viewer — read only</option>
            </select>
          </Field>

          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              <UserPlus aria-hidden="true" className="size-4" />
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
