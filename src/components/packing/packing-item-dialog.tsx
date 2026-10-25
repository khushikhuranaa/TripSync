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
import { useDemoStore, type PackingFormValues } from "@/lib/demo-store";
import type { PackingCategory, PackingItem, Trip } from "@/lib/types";

const categories: PackingCategory[] = [
  "Essentials",
  "Clothing",
  "Gear",
  "Health",
  "Documents",
];

type Errors = Partial<Record<keyof PackingFormValues, string>>;

export function PackingItemDialog({
  trip,
  item,
  trigger,
  triggerLabel = "Add item",
  variant = "primary",
  size = "md",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  trip: Trip;
  item?: PackingItem;
  trigger?: ReactNode;
  triggerLabel?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { addPackingItem, updatePackingItem } = useDemoStore();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [values, setValues] = useState<PackingFormValues>({
    name: item?.name ?? "",
    quantity: item ? String(item.quantity) : "1",
    category: item?.category ?? "Essentials",
    assignedTo: item?.assignedTo ?? "",
    notes: item?.notes ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setValues({
        name: item?.name ?? "",
        quantity: item ? String(item.quantity) : "1",
        category: item?.category ?? "Essentials",
        assignedTo: item?.assignedTo ?? "",
        notes: item?.notes ?? "",
      });
      setErrors({});
    }
  }

  function update<K extends keyof PackingFormValues>(
    key: K,
    value: PackingFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    const quantity = Number(values.quantity);

    if (!values.name.trim()) next.name = "Name the item.";
    else if (values.name.trim().length > 80)
      next.name = "Keep the item name under 80 characters.";
    if (!values.quantity.trim() || !Number.isFinite(quantity) || quantity < 1)
      next.quantity = "Use a whole number of at least 1.";
    else if (!Number.isInteger(quantity)) next.quantity = "Use a whole number.";
    if (values.notes.trim().length > 300)
      next.notes = "Keep the note under 300 characters.";

    setErrors(next);
    if (Object.keys(next).length > 0 || pending) return;

    setPending(true);
    const saved = item
      ? await updatePackingItem(item.id, values)
      : await addPackingItem(trip.id, values);
    setPending(false);
    if (saved) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant={variant} size={size}>
              <Plus aria-hidden="true" className="size-4" />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit packing item" : "Add a packing item"}</DialogTitle>
          <DialogDescription>
            Shared lists make it clear what is already covered and who is carrying
            it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field id="packing-name" label="Item" error={errors.name}>
            <Input
              id="packing-name"
              autoFocus
              placeholder="Reef-safe sunscreen"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "packing-name-error" : undefined}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field id="packing-quantity" label="Quantity" error={errors.quantity}>
              <Input
                id="packing-quantity"
                type="number"
                min={1}
                step={1}
                value={values.quantity}
                onChange={(event) => update("quantity", event.target.value)}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={
                  errors.quantity ? "packing-quantity-error" : undefined
                }
              />
            </Field>

            <Field id="packing-category" label="Category">
              <Select
                id="packing-category"
                value={values.category}
                onChange={(event) =>
                  update("category", event.target.value as PackingCategory)
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field id="packing-assignee" label="Carried by" optional>
            <Select
              id="packing-assignee"
              value={values.assignedTo}
              onChange={(event) => update("assignedTo", event.target.value)}
            >
              <option value="">Anyone</option>
              {trip.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="packing-notes"
            label="Note"
            optional
            hint={`${values.notes.length}/300`}
            error={errors.notes}
          >
            <Textarea
              id="packing-notes"
              className="min-h-20"
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="The small bottle is in the front pocket."
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "packing-notes-error" : undefined}
            />
          </Field>

          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : item ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
