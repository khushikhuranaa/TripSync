"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
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
import { useDemoStore, type ActivityFormValues } from "@/lib/demo-store";
import { eachDay, formatDayLabel } from "@/lib/format";
import type { ActivityCategory, ItineraryItem, Trip } from "@/lib/types";

const categories: ActivityCategory[] = [
  "Food",
  "Stay",
  "Transport",
  "Activity",
  "Sightseeing",
  "Shopping",
  "Free time",
];

const emptyValues: ActivityFormValues = {
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  address: "",
  mapUrl: "",
  referenceUrl: "",
  estimatedCost: "",
  description: "",
  category: "Activity",
};

type Errors = Partial<Record<keyof ActivityFormValues, string>>;

export function AddActivityDialog({
  trip,
  day,
  item,
  triggerLabel = "Add activity",
  variant = "primary",
  size = "md",
  fullWidth = false,
  trigger,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  trip: Trip;
  day: string;
  /** When provided the dialog edits an existing item. */
  item?: ItineraryItem;
  triggerLabel?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  fullWidth?: boolean;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const days = eachDay(trip.startDate, trip.endDate);
  const { addItineraryItem, updateItineraryItem } = useDemoStore();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const valuesFromItem = (entry: ItineraryItem): ActivityFormValues => ({
    title: entry.title,
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime ?? "",
    location: entry.location,
    address: entry.address ?? "",
    mapUrl: entry.mapUrl ?? "",
    referenceUrl: entry.referenceUrl ?? "",
    estimatedCost:
      entry.estimatedCost === undefined ? "" : String(entry.estimatedCost),
    description: entry.description ?? "",
    category: entry.category,
    expectedUpdatedAt: entry.updatedMs,
  });

  const [values, setValues] = useState<ActivityFormValues>(
    item ? valuesFromItem(item) : { ...emptyValues, date: day },
  );
  const [errors, setErrors] = useState<Errors>({});

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setValues(item ? valuesFromItem(item) : { ...emptyValues, date: day });
      setErrors({});
    }
  }

  function update<K extends keyof ActivityFormValues>(
    key: K,
    value: ActivityFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};

    if (!values.title.trim()) next.title = "Give the activity a name.";
    else if (values.title.trim().length > 90)
      next.title = "Keep the title under 90 characters.";

    if (!days.includes(values.date)) next.date = "Choose a date within the trip.";
    if (!values.startTime) next.startTime = "Add a start time.";
    if (values.endTime && values.endTime <= values.startTime)
      next.endTime = "The end time must be after the start time.";
    if (!values.location.trim()) next.location = "Add a place or area.";

    if (values.estimatedCost.trim()) {
      const cost = Number(values.estimatedCost);
      if (!Number.isFinite(cost) || cost < 0)
        next.estimatedCost = "Use a positive amount, or leave it empty.";
      else if (!Number.isInteger(cost))
        next.estimatedCost = "Use whole rupees.";
    }

    if (values.description.length > 400)
      next.description = "Keep the note under 400 characters.";

    if (values.address.trim().length > 200)
      next.address = "Keep the address under 200 characters.";

    for (const key of ["mapUrl", "referenceUrl"] as const) {
      const link = values[key].trim();
      if (link && !/^https?:\/\//i.test(link)) {
        next[key] = "Links must start with http:// or https://.";
      }
    }

    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || pending) return;

    setPending(true);
    const saved = item
      ? await updateItineraryItem(item.id, values)
      : await addItineraryItem(trip.id, values);
    setPending(false);
    // Close only once the server confirms the write; a failure stays on
    // screen with the reason raised as a toast.
    if (saved) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button
              variant={variant}
              size={size}
              className={fullWidth ? "w-full" : undefined}
            >
              <Plus aria-hidden="true" className="size-4" />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit activity" : "Add an activity"}</DialogTitle>
          <DialogDescription>
            {item
              ? `Update this plan in ${trip.name}. Changes appear for every member of this trip.`
              : `Add it to a specific day in ${trip.name}. Times are local to the destination.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <Field id="activity-title" label="Activity" error={errors.title}>
            <Input
              id="activity-title"
              autoFocus
              placeholder="Sunset walk along the beach"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "activity-title-error" : undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="activity-date" label="Day" error={errors.date}>
              <div className="relative">
                <Select
                  id="activity-date"
                  value={values.date}
                  onChange={(event) => update("date", event.target.value)}
                  aria-invalid={Boolean(errors.date)}
                  className="pr-9"
                >
                  {days.map((date) => (
                    <option key={date} value={date}>
                      {formatDayLabel(date)}
                    </option>
                  ))}
                </Select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                />
              </div>
            </Field>

            <Field id="activity-category" label="Type">
              <Select
                id="activity-category"
                value={values.category}
                onChange={(event) =>
                  update("category", event.target.value as ActivityCategory)
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>

            <Field id="activity-location" label="Place or area" error={errors.location}>
              <Input
                id="activity-location"
                placeholder="Palolem beach"
                value={values.location}
                onChange={(event) => update("location", event.target.value)}
                aria-invalid={Boolean(errors.location)}
                aria-describedby={
                  errors.location ? "activity-location-error" : undefined
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="activity-start" label="Starts" error={errors.startTime}>
              <Input
                id="activity-start"
                type="time"
                value={values.startTime}
                onChange={(event) => update("startTime", event.target.value)}
                aria-invalid={Boolean(errors.startTime)}
                aria-describedby={
                  errors.startTime ? "activity-start-error" : undefined
                }
              />
            </Field>

            <Field id="activity-end" label="Ends" optional error={errors.endTime}>
              <Input
                id="activity-end"
                type="time"
                value={values.endTime}
                onChange={(event) => update("endTime", event.target.value)}
                aria-invalid={Boolean(errors.endTime)}
                aria-describedby={errors.endTime ? "activity-end-error" : undefined}
              />
            </Field>

            <Field
              id="activity-cost"
              label="Est. cost"
              optional
              hint="₹"
              error={errors.estimatedCost}
            >
              <Input
                id="activity-cost"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={values.estimatedCost}
                onChange={(event) => update("estimatedCost", event.target.value)}
                aria-invalid={Boolean(errors.estimatedCost)}
                aria-describedby={
                  errors.estimatedCost ? "activity-cost-error" : undefined
                }
              />
            </Field>
          </div>

          <Field id="activity-address" label="Address" optional error={errors.address}>
            <Input
              id="activity-address"
              placeholder="North gate, coffee estate road"
              value={values.address}
              onChange={(event) => update("address", event.target.value)}
              aria-invalid={Boolean(errors.address)}
              aria-describedby={
                errors.address ? "activity-address-error" : undefined
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="activity-map" label="Map link" optional error={errors.mapUrl}>
              <Input
                id="activity-map"
                type="url"
                inputMode="url"
                placeholder="https://maps.google.com/…"
                value={values.mapUrl}
                onChange={(event) => update("mapUrl", event.target.value)}
                aria-invalid={Boolean(errors.mapUrl)}
                aria-describedby={errors.mapUrl ? "activity-map-error" : undefined}
              />
            </Field>

            <Field
              id="activity-reference"
              label="Reference link"
              optional
              error={errors.referenceUrl}
            >
              <Input
                id="activity-reference"
                type="url"
                inputMode="url"
                placeholder="Tickets, menu or guide"
                value={values.referenceUrl}
                onChange={(event) => update("referenceUrl", event.target.value)}
                aria-invalid={Boolean(errors.referenceUrl)}
                aria-describedby={
                  errors.referenceUrl ? "activity-reference-error" : undefined
                }
              />
            </Field>
          </div>

          <Field
            id="activity-description"
            label="Notes"
            optional
            hint={`${values.description.length}/400`}
            error={errors.description}
          >
            <Textarea
              id="activity-description"
              placeholder="Anything the group needs to know — booking reference, meeting point, what to carry."
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "activity-description-error" : undefined
              }
            />
          </Field>

          <DialogFooter className="mt-2">
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : item
                  ? "Save changes"
                  : "Add activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
