"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CopyPlus,
  Eye,
  LogOut,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { CreateTripDialog } from "@/components/app-shell/create-trip-dialog";
import { InviteDialog } from "@/components/invitations/invite-dialog";
import { useDemoStore } from "@/lib/demo-store";
import type { Trip } from "@/lib/types";

export function TripActions({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { state, copyTrip, deleteTrip, leaveTrip } = useDemoStore();
  const isOwner = trip.ownerId === state.profile.id;
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState<"copy" | "delete" | "leave" | null>(null);

  async function handleCopy() {
    if (busy) return;
    setBusy("copy");
    const copy = await copyTrip(trip.id);
    setBusy(null);
    if (copy) router.push(`/preview/trips/${copy.id}`);
  }

  async function handleDelete() {
    if (busy) return;
    setBusy("delete");
    const deleted = await deleteTrip(trip.id);
    setBusy(null);
    if (deleted) {
      setConfirmDelete(false);
      router.push("/preview/trips");
    }
  }

  async function handleLeave() {
    if (busy) return;
    setBusy("leave");
    const left = await leaveTrip(trip.id);
    setBusy(null);
    if (left) {
      setConfirmLeave(false);
      router.push("/preview/trips");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="md"
            className="px-2.5 sm:px-3"
            aria-label="Trip settings"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Trip settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {trip.isDemo ? (
            <>
              <DropdownMenuItem onSelect={handleCopy}>
                <CopyPlus aria-hidden="true" className="size-4 text-ink-400" />
                Create my own copy
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 h-px bg-line" />
              <DropdownMenuItem disabled>
                <Eye aria-hidden="true" className="size-4 text-ink-400" />
                Example trip is read-only
              </DropdownMenuItem>
            </>
          ) : isOwner ? (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil aria-hidden="true" className="size-4 text-ink-400" />
                Edit trip details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInviteOpen(true)}>
                <Users aria-hidden="true" className="size-4 text-ink-400" />
                Manage members
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 h-px bg-line" />
              <DropdownMenuItem
                destructive
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Delete trip
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              destructive
              onSelect={() => setConfirmLeave(true)}
            >
              <LogOut aria-hidden="true" className="size-4" />
              Leave trip
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!trip.isDemo && isOwner && (
        <>
          <CreateTripDialog
            trip={trip}
            open={editOpen}
            onOpenChange={setEditOpen}
            hideTrigger
          />
          <InviteDialog
            key={`invite-${inviteOpen}`}
            trip={trip}
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            hideTrigger
          />
        </>
      )}

      {!trip.isDemo && isOwner && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete “{trip.name}”?</DialogTitle>
              <DialogDescription>
                This permanently deletes the trip for every member, together
                with its itinerary, expenses, polls, packing list and notes.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-clay-200 bg-clay-50 px-3.5 py-3 text-[12.5px] leading-5 text-clay-700">
              Data retention: deleting removes the trip rows and every dependent
              record immediately and cannot be undone. Export anything you want
              to keep first.
            </div>

            <DialogFooter>
              <Button variant="secondary" disabled={busy !== null} onClick={() => setConfirmDelete(false)}>
                Keep trip
              </Button>
              <Button variant="danger" disabled={busy !== null} onClick={handleDelete}>
                <Trash2 aria-hidden="true" className="size-4" />
                {busy === "delete" ? "Deleting…" : "Delete trip"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {!trip.isDemo && !isOwner && (
        <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Leave “{trip.name}”?</DialogTitle>
              <DialogDescription>
                The trip will be removed from your workspace. Its plan and
                records stay available to the remaining members.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" disabled={busy !== null} onClick={() => setConfirmLeave(false)}>
                Stay in trip
              </Button>
              <Button variant="danger" disabled={busy !== null} onClick={handleLeave}>
                <LogOut aria-hidden="true" className="size-4" />
                {busy === "leave" ? "Leaving…" : "Leave trip"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
