"use client";

import { useState, type ReactNode } from "react";
import { CircleCheck, Plus } from "lucide-react";
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
  useDemoStore,
  type ExpenseFormValues,
  type ExpenseSplitMode,
} from "@/lib/demo-store";
import { splitEqually } from "@/lib/money";
import { formatCurrency, formatDateRange } from "@/lib/format";
import type { Expense, ExpenseCategory, Trip } from "@/lib/types";
import { cn } from "@/lib/cn";

const categories: ExpenseCategory[] = [
  "Stay",
  "Food",
  "Transport",
  "Activities",
  "Shopping",
  "Other",
];

type Errors = {
  description?: string;
  amount?: string;
  date?: string;
  payerId?: string;
  participantIds?: string;
  shares?: string;
  notes?: string;
};

const splitModes: { value: ExpenseSplitMode; label: string }[] = [
  { value: "equal", label: "Equally" },
  { value: "amount", label: "Amounts" },
  { value: "percent", label: "Percent" },
];

export function ExpenseDialog({
  trip,
  expense,
  trigger,
  triggerLabel = "Add expense",
  variant = "primary",
  size = "md",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  trip: Trip;
  expense?: Expense;
  trigger?: ReactNode;
  triggerLabel?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { addExpense, updateExpense, state } = useDemoStore();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  /** Detects an edited expense whose stored shares are not an equal split. */
  function customShares(): Record<string, number> | null {
    if (!expense?.shares || Object.keys(expense.shares).length === 0) return null;
    const equal = splitEqually(expense.amount, expense.participantIds);
    const differs = Object.entries(expense.shares).some(
      ([id, amount]) => equal[id] !== amount,
    );
    return differs ? expense.shares : null;
  }

  const defaults = (): ExpenseFormValues => {
    const participants =
      expense?.participantIds ?? trip.members.map((member) => member.id);
    const custom = customShares();
    return {
      description: expense?.description ?? "",
      amount: expense ? String(expense.amount) : "",
      category: expense?.category ?? "Food",
      date: expense?.date ?? trip.startDate,
      payerId: expense?.payerId ?? state.profile.id,
      participantIds: participants,
      notes: expense?.notes ?? "",
      splitMode: custom ? "amount" : "equal",
      shareInputs: custom
        ? Object.fromEntries(
            participants.map((id) => [id, String(custom[id] ?? 0)]),
          )
        : {},
    };
  };

  const [values, setValues] = useState<ExpenseFormValues>(defaults);
  const [errors, setErrors] = useState<Errors>({});

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setValues(defaults());
      setErrors({});
    }
  }

  function update<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof Errors]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function updateShare(memberId: string, value: string) {
    setValues((current) => ({
      ...current,
      shareInputs: { ...current.shareInputs, [memberId]: value },
    }));
    if (errors.shares) {
      setErrors((current) => ({ ...current, shares: undefined }));
    }
  }

  /** Switching modes seeds each person with an even starting point. */
  function setSplitMode(mode: ExpenseSplitMode) {
    setValues((current) => {
      const count = current.participantIds.length;
      const total = Number(current.amount);
      const shareInputs = { ...current.shareInputs };
      if (mode !== "equal" && count > 0) {
        for (const id of current.participantIds) {
          if (!shareInputs[id]) {
            shareInputs[id] =
              mode === "percent"
                ? (100 / count).toFixed(2)
                : (Number.isFinite(total) ? total / count : 0).toFixed(2);
          }
        }
      }
      return { ...current, splitMode: mode, shareInputs };
    });
    if (errors.shares) {
      setErrors((current) => ({ ...current, shares: undefined }));
    }
  }

  function toggleParticipant(memberId: string) {
    setValues((current) => ({
      ...current,
      participantIds: current.participantIds.includes(memberId)
        ? current.participantIds.filter((id) => id !== memberId)
        : [...current.participantIds, memberId],
    }));
    if (errors.participantIds) {
      setErrors((current) => ({ ...current, participantIds: undefined }));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    const amount = Number(values.amount);

    if (!values.description.trim()) next.description = "Describe what was paid for.";
    else if (values.description.trim().length > 90)
      next.description = "Keep the description under 90 characters.";

    if (!values.amount.trim()) next.amount = "Add the amount.";
    else if (!Number.isFinite(amount) || amount <= 0)
      next.amount = "Use an amount greater than zero.";
    else if (!Number.isInteger(amount)) next.amount = "Use whole rupees.";

    if (!values.date) next.date = "Choose the date of the expense.";
    else if (values.date < trip.startDate || values.date > trip.endDate)
      next.date = `Choose a date between ${formatDateRange(trip.startDate, trip.endDate)}.`;

    if (!values.payerId) next.payerId = "Choose who paid.";
    if (values.participantIds.length === 0)
      next.participantIds = "Choose at least one person to share this expense.";

    if (values.splitMode !== "equal" && values.participantIds.length > 0) {
      const entered = values.participantIds.map((id) =>
        Number(values.shareInputs[id] ?? "0"),
      );
      const target = values.splitMode === "percent" ? 100 : amount;
      const sum = entered.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
      if (entered.some((value) => !Number.isFinite(value) || value < 0)) {
        next.shares = "Use zero or a positive number for each person.";
      } else if (Math.abs(sum - target) > 0.01) {
        next.shares =
          values.splitMode === "percent"
            ? `Percentages add up to ${sum.toFixed(2)}%. They must add up to 100%.`
            : `The shares add up to ₹${sum.toFixed(2)} but the amount is ₹${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}.`;
      }
    }
    if (values.notes.trim().length > 300)
      next.notes = "Keep the note under 300 characters.";

    setErrors(next);
    if (Object.keys(next).length > 0 || pending) return;

    setPending(true);
    const saved = expense
      ? await updateExpense(expense.id, values)
      : await addExpense(trip.id, values);
    setPending(false);
    if (saved) setOpen(false);
  }

  const validAmount = Number(values.amount);
  const customTotal = values.participantIds.reduce((total, id) => {
    const value = Number(values.shareInputs[id]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  const customTarget =
    values.splitMode === "percent"
      ? 100
      : Number.isFinite(validAmount) && validAmount > 0
        ? validAmount
        : 0;
  const share =
    values.participantIds.length > 0 &&
    Number.isFinite(validAmount) &&
    validAmount > 0
      ? splitEqually(Math.round(validAmount), values.participantIds)
      : {};
  const shareValues = Object.values(share);
  const shareLabel =
    shareValues.length === 0
      ? null
      : new Set(shareValues).size === 1
        ? `${formatCurrency(shareValues[0], trip.currency)} each`
        : `${formatCurrency(Math.min(...shareValues), trip.currency)}–${formatCurrency(
            Math.max(...shareValues),
            trip.currency,
          )} each`;

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

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add an expense"}</DialogTitle>
          <DialogDescription>
            Record who paid and who shared the cost. Split it equally, or give
            each person their own share in rupees or percent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field id="expense-description" label="What was it for?" error={errors.description}>
            <Input
              id="expense-description"
              autoFocus
              placeholder="Beach cottages — two-night deposit"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "expense-description-error" : undefined
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="expense-amount" label="Amount" hint="₹" error={errors.amount}>
              <Input
                id="expense-amount"
                type="number"
                min={1}
                step={1}
                placeholder="2400"
                value={values.amount}
                onChange={(event) => update("amount", event.target.value)}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "expense-amount-error" : undefined}
              />
            </Field>

            <Field id="expense-category" label="Category">
              <Select
                id="expense-category"
                value={values.category}
                onChange={(event) =>
                  update("category", event.target.value as ExpenseCategory)
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="expense-date" label="Date" error={errors.date}>
              <Input
                id="expense-date"
                type="date"
                min={trip.startDate}
                max={trip.endDate}
                value={values.date}
                onChange={(event) => update("date", event.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? "expense-date-error" : undefined}
              />
            </Field>

            <Field id="expense-payer" label="Paid by" error={errors.payerId}>
              <Select
                id="expense-payer"
                value={values.payerId}
                onChange={(event) => update("payerId", event.target.value)}
                aria-invalid={Boolean(errors.payerId)}
              >
                {trip.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.id === state.profile.id ? "You" : member.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset>
            <div className="flex items-center justify-between gap-3">
              <legend className="text-[13px] font-medium text-forest-900">
                Shared by
              </legend>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "participantIds",
                      trip.members.map((member) => member.id),
                    )
                  }
                  className="text-[10.5px] font-medium text-forest-700 hover:text-clay-700"
                >
                  Select all
                </button>
                <span aria-hidden="true" className="text-ink-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => update("participantIds", [])}
                  className="text-[10.5px] font-medium text-forest-700 hover:text-clay-700"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {trip.members.map((member) => {
                const checked = values.participantIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[12px] transition-colors",
                      checked
                        ? "border-forest-700 bg-sage-50 text-forest-900"
                        : "border-line bg-card text-ink-700 hover:border-line-strong",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleParticipant(member.id)}
                      className="size-4 shrink-0 accent-forest-800"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {member.id === state.profile.id ? "You" : member.name}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.participantIds && (
              <p role="alert" className="mt-1.5 text-[12px] font-medium text-clay-700">
                {errors.participantIds}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-[13px] font-medium text-forest-900">
              How is it split?
            </legend>
            <div className="mt-2 inline-flex gap-1 rounded-lg border border-line bg-paper-50 p-1">
              {splitModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setSplitMode(mode.value)}
                  aria-pressed={values.splitMode === mode.value}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    values.splitMode === mode.value
                      ? "bg-card text-forest-900 shadow-sm"
                      : "text-ink-500 hover:text-forest-800",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {values.splitMode === "equal" ? (
              <p className="mt-2 text-[11.5px] text-ink-500">
                Each selected person covers an equal share. Rounding is handled
                in paise, so the shares always add up.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {values.participantIds.length === 0 ? (
                  <p className="text-[12px] text-ink-500">
                    Choose who shared the expense first.
                  </p>
                ) : (
                  values.participantIds.map((id) => {
                    const member = trip.members.find((entry) => entry.id === id);
                    const name =
                      id === state.profile.id ? "you" : (member?.name ?? "member");
                    return (
                      <label key={id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-700">
                          {id === state.profile.id ? "You" : member?.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`${values.splitMode === "percent" ? "Percentage" : "Share in rupees"} for ${name}`}
                            className="h-8 w-24 text-right"
                            value={values.shareInputs[id] ?? ""}
                            onChange={(event) => updateShare(id, event.target.value)}
                          />
                          <span className="w-3 text-[11px] text-ink-400">
                            {values.splitMode === "percent" ? "%" : "₹"}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
                {values.participantIds.length > 0 && (
                  <p
                    className={cn(
                      "text-[11.5px]",
                      Math.abs(customTotal - customTarget) > 0.01
                        ? "font-medium text-clay-700"
                        : "text-forest-700",
                    )}
                  >
                    {values.splitMode === "percent"
                      ? `${customTotal.toFixed(2)}% of 100%`
                      : `${formatCurrency(customTotal, trip.currency)} of ${formatCurrency(Number.isFinite(validAmount) ? validAmount : 0, trip.currency)}`}
                  </p>
                )}
                {errors.shares && (
                  <p role="alert" className="text-[11.5px] font-medium text-clay-700">
                    {errors.shares}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <Field
            id="expense-notes"
            label="Note"
            optional
            hint={`${values.notes.length}/300`}
            error={errors.notes}
          >
            <Textarea
              id="expense-notes"
              className="min-h-20"
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Paid in cash at the counter; receipt is in the shared folder."
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "expense-notes-error" : undefined}
            />
          </Field>

          {values.splitMode === "equal" && shareLabel && (
            <p className="flex items-center gap-1.5 rounded-lg border border-line bg-paper-50 px-3 py-2 text-[11.5px] text-ink-600">
              <CircleCheck aria-hidden="true" className="size-3.5 text-forest-600" />
              Equal split: <span className="font-medium text-forest-900">{shareLabel}</span>
            </p>
          )}
          {values.splitMode !== "equal" &&
            values.participantIds.length > 0 &&
            Math.abs(customTotal - customTarget) <= 0.01 && (
              <p className="flex items-center gap-1.5 rounded-lg border border-line bg-paper-50 px-3 py-2 text-[11.5px] text-ink-600">
                <CircleCheck aria-hidden="true" className="size-3.5 text-forest-600" />
                Custom split:{" "}
                <span className="font-medium text-forest-900">
                  {values.splitMode === "percent"
                    ? "100% allocated"
                    : `${formatCurrency(customTotal, trip.currency)} of ${formatCurrency(validAmount, trip.currency)} allocated`}
                </span>
              </p>
            )}

          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : expense ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
