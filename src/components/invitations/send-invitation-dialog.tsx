"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { useDemoStore } from "@/lib/demo-store";

type Errors = { tripId?: string; name?: string; email?: string };

export function SendInvitationDialog() {
  const { state, sendInvitation } = useDemoStore();
  const ownedTrips = state.trips.filter(
    (trip) => trip.ownerId === state.profile.id && !trip.isDemo,
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [tripId, setTripId] = useState(ownedTrips[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTripId(ownedTrips[0]?.id ?? "");
      setName("");
      setEmail("");
      setErrors({});
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    const cleanEmail = email.trim();
    if (!tripId) next.tripId = "Choose which trip to invite them to.";
    if (!cleanEmail) next.email = "Add the person's email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail))
      next.email = "Enter a valid email address, for example name@example.com.";
    if (name.trim().length > 60) next.name = "Keep the name under 60 characters.";

    setErrors(next);
    if (Object.keys(next).length > 0 || pending) return;

    setPending(true);
    const created = await sendInvitation(tripId, name, cleanEmail);
    setPending(false);
    if (created) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <UserPlus aria-hidden="true" className="size-3.5" />
          Invite someone
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite someone to a trip</DialogTitle>
          <DialogDescription>
            Choose a trip you own, then add the person you want to invite. The
            invitation is recorded against that trip only.
          </DialogDescription>
        </DialogHeader>

        {ownedTrips.length === 0 ? (
          <div className="mt-4 space-y-4">
            <InlineNotice variant="info" title="You have no editable trips yet">
              The example trip is read-only. Create your own trip, or copy the
              example, before inviting people.
            </InlineNotice>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Link
                href="/preview/trips"
                className={buttonStyles({ variant: "primary", size: "md" })}
              >
                Go to My trips
              </Link>
            </DialogFooter>
          </div>
        ) : (
          <>
            <InlineNotice variant="info" title="Invitations grant access on acceptance">
              The invitation is stored against the chosen trip and gives access
              to that trip only, once the person accepts. Registered members are
              notified in the app; an email is sent too when email delivery is
              configured. Invitations expire after 14 days.
            </InlineNotice>

            <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
              <Field id="send-invite-trip" label="Trip" error={errors.tripId}>
                <Select
                  id="send-invite-trip"
                  value={tripId}
                  onChange={(event) => {
                    setTripId(event.target.value);
                    if (errors.tripId)
                      setErrors((current) => ({ ...current, tripId: undefined }));
                  }}
                >
                  {ownedTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field id="send-invite-name" label="Their name" optional error={errors.name}>
                <Input
                  id="send-invite-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (errors.name)
                      setErrors((current) => ({ ...current, name: undefined }));
                  }}
                  placeholder="Sana Kapoor"
                  autoComplete="off"
                />
              </Field>

              <Field id="send-invite-email" label="Email address" error={errors.email}>
                <Input
                  id="send-invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email)
                      setErrors((current) => ({ ...current, email: undefined }));
                  }}
                  placeholder="sana@example.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? "send-invite-email-error" : undefined
                  }
                  autoComplete="off"
                />
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
