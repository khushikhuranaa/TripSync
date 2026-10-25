"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
import {
  tripCovers,
  useDemoStore,
  type TripFormValues,
} from "@/lib/demo-store";
import type { Trip } from "@/lib/types";

const emptyValues: TripFormValues = {
  name: "",
  destination: "",
  startDate: "",
  endDate: "",
  budget: "",
  travellers: "1",
  description: "",
  coverImage: tripCovers[0].value,
};

type Errors = Partial<Record<keyof TripFormValues, string>>;

function validate(values: TripFormValues): Errors {
  const errors: Errors = {};

  if (!values.name.trim()) errors.name = "Give the trip a name.";
  else if (values.name.trim().length < 3)
    errors.name = "Use at least 3 characters.";
  else if (values.name.trim().length > 80)
    errors.name = "Keep the name under 80 characters.";

  if (!values.destination.trim())
    errors.destination = "Add a city, region or destination.";

  if (!values.startDate) errors.startDate = "Choose a start date.";
  if (!values.endDate) errors.endDate = "Choose an end date.";
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = "The end date cannot be before the start date.";
  }

  if (values.budget.trim()) {
    const budget = Number(values.budget);
    if (!Number.isFinite(budget) || budget <= 0)
      errors.budget = "Enter a budget greater than 0, or leave it empty.";
    else if (budget > 10_000_000)
      errors.budget = "That budget is larger than this app supports.";
    else if (!Number.isInteger(budget))
      errors.budget = "Use whole rupees for the budget.";
  }

  const travellers = Number(values.travellers);
  if (!/^\d+$/.test(values.travellers.trim()))
    errors.travellers = "Enter a whole number of travellers.";
  else if (travellers < 1 || travellers > 99)
    errors.travellers = "Enter between 1 and 99 travellers.";

  if (values.description.length > 500)
    errors.description = "Keep the description under 500 characters.";

  return errors;
}

export function CreateTripDialog({
  triggerLabel = "New trip",
  trip,
  trigger,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  triggerLabel?: string;
  /** When provided the dialog edits this trip instead of creating a new one. */
  trip?: Trip;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const { createTrip, updateTrip } = useDemoStore();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const valuesFromTrip = (entry: Trip): TripFormValues => ({
    name: entry.name,
    destination: entry.destination,
    startDate: entry.startDate,
    endDate: entry.endDate,
    budget: entry.budget === null ? "" : String(entry.budget),
    travellers: String(entry.travellerCount ?? entry.members.length),
    description: entry.description,
    coverImage: entry.coverImage,
  });

  const [values, setValues] = useState<TripFormValues>(
    trip ? valuesFromTrip(trip) : emptyValues,
  );
  const [errors, setErrors] = useState<Errors>({});

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setValues(trip ? valuesFromTrip(trip) : emptyValues);
      setErrors({});
    }
  }

  function update<K extends keyof TripFormValues>(
    key: K,
    value: TripFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || pending) return;

    setPending(true);
    if (trip) {
      const updated = await updateTrip(trip.id, values);
      setPending(false);
      // Stay open on failure: the toast explains what the server refused.
      if (updated) setOpen(false);
      return;
    }

    const created = await createTrip(values);
    setPending(false);
    if (!created) return;
    setOpen(false);
    router.push(`/preview/trips/${created.id}`);
  }

  const title = trip ? "Edit trip details" : "Create a trip";
  const description = trip
    ? "Update the plans, dates and budget. Everyone with access to this trip sees the change."
    : "Start with the basics. Members, itinerary and expenses are added inside the trip workspace.";

  const defaultTrigger = (
    <Button size="md" className="px-3 sm:px-4">
      <Plus aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">{triggerLabel}</span>
      <span className="sr-only sm:hidden">{triggerLabel}</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      )}

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <Field id="trip-name" label="Trip name" error={errors.name}>
            <Input
              id="trip-name"
              name="name"
              autoFocus
              placeholder="Goa in December"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "trip-name-error" : undefined}
            />
          </Field>

          <Field
            id="trip-destination"
            label="Destination"
            error={errors.destination}
          >
            <Input
              id="trip-destination"
              name="destination"
              placeholder="Palolem, Goa"
              value={values.destination}
              onChange={(event) => update("destination", event.target.value)}
              aria-invalid={Boolean(errors.destination)}
              aria-describedby={
                errors.destination ? "trip-destination-error" : undefined
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="trip-start" label="Start date" error={errors.startDate}>
              <Input
                id="trip-start"
                name="startDate"
                type="date"
                value={values.startDate}
                onChange={(event) => update("startDate", event.target.value)}
                aria-invalid={Boolean(errors.startDate)}
                aria-describedby={errors.startDate ? "trip-start-error" : undefined}
              />
            </Field>

            <Field id="trip-end" label="End date" error={errors.endDate}>
              <Input
                id="trip-end"
                name="endDate"
                type="date"
                min={values.startDate || undefined}
                value={values.endDate}
                onChange={(event) => update("endDate", event.target.value)}
                aria-invalid={Boolean(errors.endDate)}
                aria-describedby={errors.endDate ? "trip-end-error" : undefined}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="trip-budget" label="Budget" optional hint="Whole rupees" error={errors.budget}>
              <Input
                id="trip-budget"
                name="budget"
                inputMode="numeric"
                type="number"
                min={1}
                step={1}
                placeholder="48000"
                value={values.budget}
                onChange={(event) => update("budget", event.target.value)}
                aria-invalid={Boolean(errors.budget)}
                aria-describedby={errors.budget ? "trip-budget-error" : undefined}
              />
            </Field>

            <Field id="trip-travellers" label="Travellers" error={errors.travellers}>
              <Input
                id="trip-travellers"
                name="travellers"
                inputMode="numeric"
                type="number"
                min={1}
                max={99}
                step={1}
                value={values.travellers}
                onChange={(event) => update("travellers", event.target.value)}
                aria-invalid={Boolean(errors.travellers)}
                aria-describedby={errors.travellers ? "trip-travellers-error" : undefined}
              />
            </Field>
          </div>

          <Field id="trip-cover" label="Cover photo">
            <Select
              id="trip-cover"
              value={values.coverImage}
              onChange={(event) => {
                update("coverImage", event.target.value);
                if (!values.destination.trim()) return;
              }}
            >
              {tripCovers.map((cover) => (
                <option key={cover.value} value={cover.value}>
                  {cover.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="trip-description"
            label="Description"
            optional
            hint={`${values.description.length}/500`}
            error={errors.description}
          >
            <Textarea
              id="trip-description"
              name="description"
              placeholder="What kind of trip is this? Anything the group should know before joining?"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "trip-description-error" : undefined
              }
            />
          </Field>

          <DialogFooter className="mt-2 flex-col sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10.5px] leading-4 text-ink-400 sm:max-w-[260px]">
              Saved to your TripSync account and visible to every member of the
              trip.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? trip
                    ? "Saving…"
                    : "Creating…"
                  : trip
                    ? "Save changes"
                    : "Create trip"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
