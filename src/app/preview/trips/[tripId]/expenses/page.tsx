"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Info,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  Scale,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, InlineNotice, ProgressBar } from "@/components/ui/feedback";
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
import { BudgetBar } from "@/components/trips/budget-bar";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { ExpenseIcon } from "@/components/expenses/expense-meta";
import { SectionHeading } from "@/components/ui/section-heading";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/cn";
import {
  splitBreakdown,
  suggestSettlements,
  summarizeExpenses,
} from "@/lib/money";
import {
  formatCount,
  formatCurrency,
  formatDate,
  formatDateRange,
} from "@/lib/format";
import type { Expense } from "@/lib/types";
import { TripUnavailable } from "@/components/trips/trip-unavailable";

function splitText(
  amount: number,
  participants: string[],
  currency: "INR",
): string {
  const parts = splitBreakdown(amount, participants);
  if (parts.length === 1) {
    return `${formatCurrency(amount, currency)} ÷ ${participants.length} = ${formatCurrency(
      parts[0].amount,
      currency,
    )} each`;
  }
  return `${formatCurrency(amount, currency)} ÷ ${participants.length} = ${parts
    .map(
      (part) => `${formatCurrency(part.amount, currency)} for ${part.people}`,
    )
    .join(" · ")}`;
}

function ExpenseMenu({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-ink-400"
          aria-label={`Actions for ${expense.description}`}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden="true" className="size-4 text-ink-400" />
          Edit expense
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-line" />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete expense
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ExpensesPage() {
  const params = useParams<{ tripId: string }>();
  const { state, deleteExpense } = useDemoStore();
  const trip = state.trips.find((entry) => entry.id === params.tripId);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  if (!trip) return <TripUnavailable />;

  const myAccess = trip.members.find((member) => member.isCurrentUser)?.access;
  // The server re-checks this on every mutation; hiding the controls keeps the
  // interface honest for viewers instead of offering actions that will fail.
  const canEdit =
    !trip.isDemo && (myAccess === "owner" || myAccess === "editor");

  const expenses = state.expenses
    .filter((expense) => expense.tripId === trip.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const memberIds = trip.members.map((member) => member.id);
  const summary = summarizeExpenses(expenses, memberIds, trip.budget);
  const yourBalance =
    summary.balances.find((balance) => balance.memberId === state.profile.id)
      ?.share ?? 0;
  const usedPercent =
    trip.budget === null || trip.budget <= 0
      ? null
      : Math.round((summary.total / trip.budget) * 100);
  const settlements = suggestSettlements(summary.balances);
  const spentByDay = new Map<string, number>();
  for (const expense of expenses) {
    spentByDay.set(expense.date, (spentByDay.get(expense.date) ?? 0) + expense.amount);
  }
  const daily = [...spentByDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const addAction = trip.isDemo ? (
    <CopyTripButton tripId={trip.id} size="md" label="Copy to add expenses" />
  ) : canEdit ? (
    <ExpenseDialog trip={trip} size="md" />
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Shared costs</p>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-[-0.025em] text-forest-900">
            Where the money has gone
          </h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-ink-500">
            Recorded expenses for {formatDateRange(trip.startDate, trip.endDate)}.
            The split is shown for every expense, not just the total.
          </p>
        </div>
        {addAction}
      </div>

      <section
        aria-label="Budget summary"
        className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Budget
          </p>
          <p className="mt-1 text-[16px] font-semibold text-forest-900">
            {trip.budget === null
              ? "Not set"
              : formatCurrency(trip.budget, trip.currency)}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Recorded
          </p>
          <p className="mt-1 text-[16px] font-semibold text-forest-900">
            {formatCurrency(summary.total, trip.currency)}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            {summary.remaining !== null && summary.remaining < 0
              ? "Over budget"
              : "Remaining"}
          </p>
          <p
            className={[
              "mt-1 text-[16px] font-semibold",
              summary.remaining !== null && summary.remaining < 0
                ? "text-clay-700"
                : "text-forest-900",
            ].join(" ")}
          >
            {summary.remaining === null
              ? "—"
              : formatCurrency(Math.abs(summary.remaining), trip.currency)}
          </p>
        </div>
        <div className="bg-card px-4 py-3.5 sm:px-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            Your share
          </p>
          <p className="mt-1 text-[16px] font-semibold text-forest-900">
            {formatCurrency(yourBalance, trip.currency)}
          </p>
        </div>
      </section>

      {!trip.isDemo && !canEdit && (
        <InlineNotice variant="info" title="View-only access">
          You can review every recorded expense, the split and the balances.
          Only the trip owner or an editor can add, edit or delete an expense.
        </InlineNotice>
      )}

      <div className="rounded-xl border border-line bg-card px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[12px] font-medium text-forest-900">
            {trip.budget === null
              ? "No budget has been set for this trip."
              : `${formatCurrency(summary.total, trip.currency)} of ${formatCurrency(
                  trip.budget,
                  trip.currency,
                )} used`}
          </p>
          {usedPercent !== null && (
            <span
              className={cn(
                "text-[10.5px]",
                usedPercent > 100 ? "font-medium text-clay-700" : "text-ink-400",
              )}
            >
              {usedPercent}% of budget
            </span>
          )}
        </div>
        <BudgetBar
          budget={trip.budget}
          spent={summary.total}
          currency={trip.currency}
          showLabels={false}
          showRemaining={false}
          className="mt-2"
        />
        <p className="mt-2 text-[11px] text-ink-500">
          {expenses.length} recorded {expenses.length === 1 ? "expense" : "expenses"} ·
splits stored per person, down to the paisa
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <section className="space-y-3">
          <SectionHeading
            title="Recorded expenses"
            description="Newest first. Each line shows who paid and how the amount was divided."
          />

          {expenses.length > 0 ? (
            <div className="rounded-xl border border-line bg-card px-4 sm:px-5">
              <ul className="divide-y divide-line">
                {expenses.map((expense) => {
                  const payer = trip.members.find(
                    (member) => member.id === expense.payerId,
                  );
                  const participants = trip.members.filter((member) =>
                    expense.participantIds.includes(member.id),
                  );
                  return (
                    <li key={expense.id} className="flex gap-3 py-4">
                      <ExpenseIcon category={expense.category} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <p className="min-w-0 text-[13px] font-medium leading-5 text-forest-900">
                            {expense.description}
                          </p>
                          <p className="shrink-0 text-[13px] font-semibold tabular-nums text-forest-900">
                            {formatCurrency(expense.amount, trip.currency)}
                          </p>
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-500">
                          <span>{formatDate(expense.date, { year: undefined })}</span>
                          <span aria-hidden="true">·</span>
                          <span>{expense.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Paid by{" "}
                            <span className="font-medium text-forest-800">
                              {payer?.name.split(" ")[0] ?? "a former member"}
                            </span>
                          </span>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <AvatarStack members={participants} max={4} size="xs" />
                          <span className="text-[10.5px] text-ink-400">
                            {formatCount(participants.length, "participant")}
                          </span>
                          {canEdit && (
                            <span className="ml-auto">
                              <ExpenseMenu
                                expense={expense}
                                onEdit={() => setEditing(expense)}
                                onDelete={() => setDeleting(expense)}
                              />
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[10.5px] leading-4 text-ink-400">
                          {splitText(
                            expense.amount,
                            expense.participantIds,
                            trip.currency,
                          )}
                        </p>
                        {expense.notes && (
                          <p className="mt-1 text-[11px] leading-4 text-ink-500">
                            {expense.notes}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No expenses recorded"
              description={
                trip.isDemo
                  ? "This example has no expenses. Make a copy to start recording shared costs."
                  : "Add the first shared cost with a payer and the people who took part. The equal split will be calculated from those details."
              }
              action={
                trip.isDemo ? (
                  <CopyTripButton tripId={trip.id} />
                ) : canEdit ? (
                  <ExpenseDialog trip={trip} />
                ) : (
                  <p className="text-[12px] text-ink-500">
                    Ask the owner for editing access to record expenses.
                  </p>
                )
              }
            />
          )}

          <p className="flex items-start gap-1.5 text-[10.5px] leading-4 text-ink-400">
            <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
            TripSync records the plan only; it does not process payments or
            transfer money.
          </p>
        </section>

        <aside className="space-y-4">
          <section className="card-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Balances</p>
              <Scale aria-hidden="true" className="size-3.5 text-ink-400" />
            </div>
            <p className="mt-2 text-[11.5px] leading-5 text-ink-500">
              Each expense is divided across the people included in it — equally,
              or by the custom shares that were saved. The balances below combine
              every record.
            </p>

            <ul className="mt-3 divide-y divide-line">
              {summary.balances.map((balance) => {
                const member = trip.members.find(
                  (entry) => entry.id === balance.memberId,
                );
                if (!member) return null;
                const positive = balance.balance > 0;
                const settled = balance.balance === 0;
                return (
                  <li key={balance.memberId} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar member={member} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-forest-900">
                        {member.name.split(" ")[0]}
                      </span>
                      <span
                        className={[
                          "shrink-0 text-[11px] font-medium tabular-nums",
                          settled
                            ? "text-ink-400"
                            : positive
                              ? "text-forest-700"
                              : "text-clay-700",
                        ].join(" ")}
                      >
                        {settled
                          ? "Settled"
                          : `${positive ? "Gets back" : "Owes"} ${formatCurrency(
                              Math.abs(balance.balance),
                              trip.currency,
                            )}`}
                      </span>
                    </div>
                    <p className="ml-8 mt-0.5 text-[10px] tabular-nums text-ink-400">
                      Paid {formatCurrency(balance.paid, trip.currency)} · share{" "}
                      {formatCurrency(balance.share, trip.currency)}
                    </p>
                  </li>
                );
              })}
            </ul>

            {settlements.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="eyebrow">Suggested settlements</p>
                <ul className="mt-2 space-y-1.5">
                  {settlements.map((settlement) => {
                    const from = trip.members.find(
                      (member) => member.id === settlement.fromMemberId,
                    );
                    const to = trip.members.find(
                      (member) => member.id === settlement.toMemberId,
                    );
                    if (!from || !to) return null;
                    return (
                      <li
                        key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                        className="flex items-center gap-1.5 text-[11px] text-ink-600"
                      >
                        <span className="font-medium text-forest-800">
                          {from.name.split(" ")[0]}
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3 text-ink-400"
                        />
                        <span className="font-medium text-forest-800">
                          {to.name.split(" ")[0]}
                        </span>
                        <span className="ml-auto font-medium tabular-nums text-forest-900">
                          {formatCurrency(settlement.amount, trip.currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[10px] leading-4 text-ink-400">
                  A calculation from the recorded expenses only — TripSync does
                  not move money or mark anything as paid.
                </p>
              </div>
            )}

            <p className="mt-3 border-t border-line pt-3 text-[10.5px] leading-4 text-ink-400">
              Amounts are stored in paise. When an amount does not divide evenly,
              the first participants cover the extra paisa, so stored shares
              always add up exactly to the recorded total.
            </p>
          </section>

          {daily.length > 0 && (
            <section className="card-surface p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">By day</p>
                <Badge variant="outline">{daily.length} days</Badge>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {daily.map(([date, amount]) => (
                  <li
                    key={date}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-[11.5px]"
                  >
                    <span className="text-ink-700">
                      {formatDate(date, { year: undefined })}
                    </span>
                    <span className="font-medium tabular-nums text-forest-900">
                      {formatCurrency(amount, trip.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] leading-4 text-ink-400">
                Daily totals are summed from the same saved expenses as the
                budget figures above.
              </p>
            </section>
          )}

          <section className="card-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">By category</p>
              <Badge variant="outline">
                {summary.categoryTotals.length}{" "}
                {summary.categoryTotals.length === 1 ? "category" : "categories"}
              </Badge>
            </div>
            {summary.categoryTotals.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {summary.categoryTotals.map((category) => (
                  <li key={category.category}>
                    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
                      <span className="text-ink-700">{category.category}</span>
                      <span className="font-medium tabular-nums text-forest-900">
                        {formatCurrency(category.amount, trip.currency)}
                      </span>
                    </div>
                    <ProgressBar
                      value={category.amount}
                      max={summary.total}
                      tone="sage"
                      label={`${category.category}: ${formatCurrency(
                        category.amount,
                        trip.currency,
                      )}`}
                      className="mt-1.5 h-1"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11.5px] text-ink-400">
                Category totals appear once an expense is recorded.
              </p>
            )}
          </section>

          <Link
            href={`/preview/trips/${trip.id}/itinerary`}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-forest-800 hover:text-clay-700"
          >
            Review the itinerary
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </aside>
      </div>

      <p className="text-[11px] leading-5 text-ink-400">
        Expenses are stored with the trip and visible only to its members.
        Totals and balances recalculate for everyone after every change.
      </p>

      {canEdit && (
        <>
          {editing && (
            <ExpenseDialog
              trip={trip}
              expense={editing}
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
                <DialogTitle>Delete “{deleting?.description}”?</DialogTitle>
                <DialogDescription>
                  This removes the expense and recalculates every total and
                  balance. Other expenses are left untouched.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" disabled={deletePending} onClick={() => setDeleting(null)}>
                  Keep expense
                </Button>
                <Button
                  variant="danger"
                  disabled={deletePending}
                  onClick={async () => {
                    if (!deleting || deletePending) return;
                    setDeletePending(true);
                    const removed = await deleteExpense(deleting.id);
                    setDeletePending(false);
                    if (removed) setDeleting(null);
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {deletePending ? "Deleting…" : "Delete expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
