"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
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
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useDemoStore, type NoteFormValues } from "@/lib/demo-store";
import type { NoteCategory, Trip, TripNote } from "@/lib/types";

const categories: NoteCategory[] = [
  "General",
  "Bookings",
  "Transport",
  "Food",
  "Contacts",
  "Other",
];

type Errors = Partial<Record<keyof NoteFormValues, string>>;

export function NoteDialog({
  trip,
  note,
  trigger,
  triggerLabel = "Add note",
  size = "md",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  trip: Trip;
  note?: TripNote;
  trigger?: ReactNode;
  triggerLabel?: string;
  size?: "sm" | "md";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { addNote, updateNote } = useDemoStore();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [values, setValues] = useState<NoteFormValues>({
    title: note?.title ?? "",
    body: note?.body ?? "",
    category: note?.category ?? "General",
  });
  const [errors, setErrors] = useState<Errors>({});

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setValues({
        title: note?.title ?? "",
        body: note?.body ?? "",
        category: note?.category ?? "General",
      });
      setErrors({});
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    if (!values.title.trim()) next.title = "Give the note a short title.";
    else if (values.title.trim().length > 80)
      next.title = "Keep the title under 80 characters.";
    if (!values.body.trim()) next.body = "Write the detail the group needs.";
    else if (values.body.trim().length > 2000)
      next.body = "Keep the note under 2,000 characters.";

    setErrors(next);
    if (Object.keys(next).length > 0 || pending) return;

    setPending(true);
    // The note's version travels with the save so the server can refuse a
    // write that would silently overwrite someone else's newer edit.
    const saved = note
      ? await updateNote(note.id, values, note.updatedAt)
      : await addNote(trip.id, values);
    setPending(false);
    if (saved) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size={size}>
              <Plus aria-hidden="true" className="size-4" />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "Add a shared note"}</DialogTitle>
          <DialogDescription>
            Notes are visible to everyone in {trip.name}. Use them for booking
            references, meeting points and practical details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field id="note-title" label="Title" error={errors.title}>
            <Input
              id="note-title"
              autoFocus
              value={values.title}
              onChange={(event) => {
                setValues((current) => ({ ...current, title: event.target.value }));
                if (errors.title)
                  setErrors((current) => ({ ...current, title: undefined }));
              }}
              placeholder="Airport transfer"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "note-title-error" : undefined}
            />
          </Field>

          <Field id="note-category" label="Label" optional>
            <Select
              id="note-category"
              value={values.category}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  category: event.target.value as NoteCategory,
                }))
              }
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="note-body"
            label="Note"
            hint={`${values.body.length}/2000`}
            error={errors.body}
          >
            <Textarea
              id="note-body"
              className="min-h-36"
              value={values.body}
              onChange={(event) => {
                setValues((current) => ({ ...current, body: event.target.value }));
                if (errors.body)
                  setErrors((current) => ({ ...current, body: undefined }));
              }}
              placeholder="Our flight lands at 13:10. Two cabs are booked; meet at arrivals near the coffee kiosk."
              aria-invalid={Boolean(errors.body)}
              aria-describedby={errors.body ? "note-body-error" : undefined}
            />
          </Field>

          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : note ? "Save changes" : "Add note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
