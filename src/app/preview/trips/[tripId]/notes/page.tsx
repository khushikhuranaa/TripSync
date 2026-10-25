"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { NotebookPen, Trash2 } from "lucide-react";
import { NoteCard } from "@/components/notes/note-card";
import { NoteDialog } from "@/components/notes/note-dialog";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { Button } from "@/components/ui/button";
import { EmptyState, InlineNotice } from "@/components/ui/feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDemoStore } from "@/lib/demo-store";
import { formatCount } from "@/lib/format";
import type { TripNote } from "@/lib/types";
import { TripUnavailable } from "@/components/trips/trip-unavailable";

export default function NotesPage() {
  const params = useParams<{ tripId: string }>();
  const { state, deleteNote } = useDemoStore();
  const trip = state.trips.find((entry) => entry.id === params.tripId);
  const [editing, setEditing] = useState<TripNote | null>(null);
  const [deleting, setDeleting] = useState<TripNote | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  if (!trip) return <TripUnavailable />;

  const myAccess = trip.members.find((member) => member.isCurrentUser)?.access;
  const canEdit =
    !trip.isDemo && (myAccess === "owner" || myAccess === "editor");

  const tripNotes = state.notes
    .filter((note) => note.tripId === trip.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Shared context</p>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-[-0.025em] text-forest-900">
            Things worth writing down
          </h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-ink-500">
            Booking references, meeting points and the small details that should
            not live in someone&apos;s private messages.
          </p>
        </div>
        {trip.isDemo ? (
          <CopyTripButton tripId={trip.id} size="md" label="Copy to edit notes" />
        ) : canEdit ? (
          <NoteDialog trip={trip} size="md" />
        ) : null}
      </div>

      {trip.isDemo && (
        <InlineNotice variant="preview" title="Example trip — read only">
          These notes show the intended layout and content. Create a copy of the
          trip to add, edit or delete notes.
        </InlineNotice>
      )}

      {!trip.isDemo && !canEdit && (
        <InlineNotice variant="info" title="View-only access">
          You can read every shared note. Only the owner or an editor can add or
          edit one, and a note can be deleted by its author or the trip owner.
        </InlineNotice>
      )}

      {tripNotes.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {tripNotes.map((note, index) => (
              <div
                key={note.id}
                className={index === 0 && tripNotes.length > 2 ? "sm:col-span-2" : ""}
              >
                <NoteCard
                  note={note}
                  trip={trip}
                  featured={index === 0 && tripNotes.length > 2}
                  readOnly={!canEdit}
                  canDelete={
                    canEdit &&
                    (note.authorId === state.profile.id || myAccess === "owner")
                  }
                  onEdit={() => setEditing(note)}
                  onDelete={() => setDeleting(note)}
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-5 text-ink-400">
            {formatCount(tripNotes.length, "note")} · visible only to people in
            this trip
            {trip.isDemo ? " · read-only example" : " · saved to your account"}
          </p>
        </>
      ) : (
        <EmptyState
          icon={NotebookPen}
          title="No shared notes yet"
          description={
            trip.isDemo
              ? "This example has no notes. Make a copy to add the details the group should not lose."
              : "Add a note for the details that matter to everyone: check-in times, booking references, food preferences or a plan B for bad weather."
          }
          action={
            trip.isDemo ? (
              <CopyTripButton tripId={trip.id} />
            ) : canEdit ? (
              <NoteDialog trip={trip} triggerLabel="Add the first note" />
            ) : (
              <p className="text-[12px] text-ink-500">
                Ask the owner for editing access to add notes.
              </p>
            )
          }
        />
      )}

      {canEdit && (
        <>
          {editing && (
            <NoteDialog
              trip={trip}
              note={editing}
              open={Boolean(editing)}
              onOpenChange={(open) => {
                if (!open) setEditing(null);
              }}
              hideTrigger
            />
          )}

          <Dialog
            open={Boolean(deleting)}
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete “{deleting?.title}”?</DialogTitle>
                <DialogDescription>
                  This removes the note for everyone on this trip. Other notes
                  are left untouched.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" disabled={deletePending} onClick={() => setDeleting(null)}>
                  Keep note
                </Button>
                <Button
                  variant="danger"
                  disabled={deletePending}
                  onClick={async () => {
                    if (!deleting || deletePending) return;
                    setDeletePending(true);
                    const removed = await deleteNote(deleting.id);
                    setDeletePending(false);
                    if (removed) setDeleting(null);
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {deletePending ? "Deleting…" : "Delete note"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
