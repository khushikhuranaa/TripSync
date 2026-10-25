"use client";

import { useState } from "react";
import { Check, Copy, Link2, Trash2, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineNotice } from "@/components/ui/feedback";
import { useDemoStore } from "@/lib/demo-store";
import { formatDateRange } from "@/lib/format";
import type { Invitation, Trip } from "@/lib/types";

/**
 * The owner's control room for a trip: members and their roles, plus pending
 * invitations. Every action is a server round trip that re-checks ownership, so
 * this dialog is a convenience over the real permission boundary.
 */
export function MembersDialog({
  trip,
  open,
  onOpenChange,
  onInvite,
}: {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: () => void;
}) {
  const {
    state,
    updateMemberRole,
    removeMember,
    revokeInvitation,
  } = useDemoStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const pending = state.invitations.filter(
    (invitation) =>
      invitation.kind === "sent" &&
      invitation.tripId === trip.id &&
      invitation.status === "pending",
  );

  async function copyLink(invitation: Invitation) {
    if (!invitation.token) return;
    const link = `${window.location.origin}/invite/${invitation.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(invitation.id);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      // Clipboard permissions can be refused; the link stays visible to copy.
      setCopied(null);
    }
  }

  async function changeRole(userId: string, role: "editor" | "viewer") {
    if (busy) return;
    setBusy(`role:${userId}`);
    await updateMemberRole(trip.id, userId, role);
    setBusy(null);
  }

  async function confirmAndRemove() {
    if (!confirmRemove || busy) return;
    setBusy(`remove:${confirmRemove.id}`);
    const removed = await removeMember(trip.id, confirmRemove.id);
    setBusy(null);
    if (removed) setConfirmRemove(null);
  }

  async function withdraw(invitationId: string) {
    if (busy) return;
    setBusy(`revoke:${invitationId}`);
    await revokeInvitation(invitationId);
    setBusy(null);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users aria-hidden="true" className="size-4 text-ink-400" />
              Who can see {trip.name}
            </DialogTitle>
            <DialogDescription>
              {formatDateRange(trip.startDate, trip.endDate)} · Owners manage
              access, editors change the plan, viewers read it.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <p className="eyebrow">Members</p>
              <ul className="mt-2 space-y-2">
                {trip.members.map((member) => {
                  const isOwner = member.access === "owner";
                  return (
                    <li
                      key={member.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5"
                    >
                      <Avatar member={member} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold text-forest-900">
                          {member.name}
                          {member.isCurrentUser ? (
                            <span className="ml-1.5 text-[10.5px] font-normal text-ink-400">
                              you
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-[11px] text-ink-500">
                          {member.email}
                        </p>
                      </div>

                      {isOwner ? (
                        <Badge variant="forest">Owner</Badge>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`role-${member.id}`}>
                            Role for {member.name}
                          </label>
                          <select
                            id={`role-${member.id}`}
                            value={member.access}
                            disabled={busy !== null}
                            onChange={(event) =>
                              changeRole(
                                member.id,
                                event.target.value as "editor" | "viewer",
                              )
                            }
                            className="h-8 rounded-lg border border-line-strong bg-card px-2 text-[11.5px] text-ink-700 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-ink-400 hover:text-clay-700"
                            aria-label={`Remove ${member.name} from this trip`}
                            disabled={busy !== null}
                            onClick={() =>
                              setConfirmRemove({ id: member.id, name: member.name })
                            }
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="eyebrow">Pending invitations</p>
              {pending.length === 0 ? (
                <p className="mt-2 text-[11.5px] leading-5 text-ink-500">
                  Nobody is waiting to join. Invitations expire after 14 days and
                  can be withdrawn before they are accepted.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {pending.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="rounded-lg border border-line bg-card px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-forest-900">
                            {invitation.inviteeName}
                          </p>
                          <p className="truncate text-[11px] text-ink-500">
                            {invitation.inviteeEmail}
                          </p>
                        </div>
                        <Badge variant="muted">
                          {invitation.role === "viewer" ? "Viewer" : "Editor"}
                        </Badge>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copyLink(invitation)}
                          disabled={!invitation.token}
                        >
                          {copied === invitation.id ? (
                            <Check aria-hidden="true" className="size-3.5" />
                          ) : (
                            <Copy aria-hidden="true" className="size-3.5" />
                          )}
                          {copied === invitation.id ? "Copied" : "Copy link"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => withdraw(invitation.id)}
                        >
                          Withdraw
                        </Button>
                      </div>
                      {invitation.token && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-paper-300 bg-paper-100 px-2 py-1.5 text-[10.5px] leading-4 text-ink-500">
                          <Link2 aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                          <span className="break-all">
                            /invite/{invitation.token.slice(0, 10)}…
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <InlineNotice variant="info" title="Access ends immediately">
              Removing someone deletes their membership on the server, so the next
              request they make for this trip is refused. Their account and other
              trips are untouched.
            </InlineNotice>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                onInvite();
              }}
            >
              <UserPlus aria-hidden="true" className="size-4" />
              Invite someone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => {
          if (!next) setConfirmRemove(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {confirmRemove?.name}?</DialogTitle>
            <DialogDescription>
              They lose access to this trip and its itinerary immediately. Nothing
              else in their account changes, and you can invite them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => setConfirmRemove(null)}
            >
              Keep member
            </Button>
            <Button variant="danger" disabled={busy !== null} onClick={confirmAndRemove}>
              <Trash2 aria-hidden="true" className="size-4" />
              {busy?.startsWith("remove:") ? "Removing…" : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
