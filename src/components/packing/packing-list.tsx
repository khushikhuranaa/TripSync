"use client";

import { useMemo, useState } from "react";
import {
  Backpack,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
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
import { PackingItemDialog } from "@/components/packing/packing-item-dialog";
import { CopyTripButton } from "@/components/trips/copy-trip-button";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/cn";
import type { PackingItem } from "@/lib/types";
import { TripUnavailable } from "@/components/trips/trip-unavailable";

type Filter = "all" | "packed" | "unpacked";

export function PackingList({ tripId }: { tripId: string }) {
  const {
    state,
    togglePackingItem,
    deletePackingItem,
  } = useDemoStore();
  const trip = state.trips.find((entry) => entry.id === tripId);
  const list = state.packingItems.filter((item) => item.tripId === tripId);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<PackingItem | null>(null);
  const [deleting, setDeleting] = useState<PackingItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const packedCount = list.filter((item) => item.packed).length;
  const percentage = list.length === 0 ? 0 : Math.round((packedCount / list.length) * 100);

  const visible = useMemo(() => {
    if (filter === "packed") return list.filter((item) => item.packed);
    if (filter === "unpacked") return list.filter((item) => !item.packed);
    return list;
  }, [filter, list]);

  if (!trip) return <TripUnavailable />;

  const myAccess = trip.members.find((member) => member.isCurrentUser)?.access;
  const canEdit =
    !trip.isDemo && (myAccess === "owner" || myAccess === "editor");

  const action = trip.isDemo ? (
    <CopyTripButton tripId={trip.id} size="md" label="Copy to edit packing" />
  ) : canEdit ? (
    <PackingItemDialog trip={trip} size="md" />
  ) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Prepared together</p>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-[-0.025em] text-forest-900">
            Packing list
          </h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-ink-500">
            Quantities, who is carrying what, and a shared view of what is already
            packed.
          </p>
        </div>
        {action}
      </div>

      <section className="card-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-forest-900">
              {list.length > 0
                ? `${packedCount} of ${list.length} packed`
                : "Nothing on the list yet"}
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {list.length > 0
                ? `${percentage}% ready · ${list.length - packedCount} still to pack`
                : "Add the first item so the group can see what is needed."}
            </p>
          </div>
          <div className="w-full sm:max-w-[220px]">
            <ProgressBar
              value={packedCount}
              max={list.length || 1}
              label={`${packedCount} of ${list.length} items packed`}
              tone={percentage === 100 ? "forest" : "sage"}
            />
          </div>
        </div>
      </section>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter packing items"
      >
        {(
          [
            ["all", "All", list.length],
            ["unpacked", "Still to pack", list.length - packedCount],
            ["packed", "Packed", packedCount],
          ] as const
        ).map(([value, label, count]) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-medium transition-colors",
                active
                  ? "border-forest-900 bg-forest-900 text-paper-50"
                  : "border-line bg-card text-ink-500 hover:border-line-strong hover:text-forest-800",
              )}
            >
              {label}
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-paper-200/70" : "text-ink-400",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {list.length > 0 ? (
        visible.length > 0 ? (
          <div className="rounded-xl border border-line bg-card px-4 shadow-soft sm:px-5">
            <ul className="divide-y divide-line">
              {visible.map((item) => {
                const assignee = item.assignedTo
                  ? trip.members.find((member) => member.id === item.assignedTo)
                  : undefined;
                return (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      id={`pack-${item.id}`}
                      checked={item.packed}
                      disabled={!canEdit || toggling === item.id}
                      onChange={async () => {
                        if (toggling) return;
                        setToggling(item.id);
                        await togglePackingItem(item.id);
                        setToggling(null);
                      }}
                      className="size-4 shrink-0 cursor-pointer rounded-[3px] accent-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <label
                      htmlFor={`pack-${item.id}`}
                      className={cn(
                        "min-w-0 flex-1",
                        trip.isDemo ? "cursor-default" : "cursor-pointer",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[12.5px] font-medium transition-colors",
                          item.packed
                            ? "text-ink-400 line-through decoration-ink-400/60"
                            : "text-forest-900",
                        )}
                      >
                        {item.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-ink-400">
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Quantity {item.quantity}</span>
                      </span>
                      {item.notes && (
                        <span className="mt-0.5 block text-[10.5px] leading-4 text-ink-500">
                          {item.notes}
                        </span>
                      )}
                    </label>

                    {assignee ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper-50 py-0.5 pl-0.5 pr-2">
                        <Avatar member={assignee} size="xs" />
                        <span className="text-[10px] font-medium text-ink-500">
                          {assignee.name.split(" ")[0]}
                        </span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 text-[10px] text-ink-400"
                        title="Anyone can bring this"
                      >
                        <UserRound aria-hidden="true" className="size-3" />
                        Anyone
                      </span>
                    )}

                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-ink-400"
                            aria-label={`Actions for ${item.name}`}
                          >
                            <MoreHorizontal aria-hidden="true" className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(item)}>
                            <Pencil aria-hidden="true" className="size-4 text-ink-400" />
                            Edit item
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1 h-px bg-line" />
                          <DropdownMenuItem
                            destructive
                            onSelect={() => setDeleting(item)}
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                            Remove item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <EmptyState
            icon={filter === "packed" ? Backpack : Plus}
            title={filter === "packed" ? "Nothing packed yet" : "Everything is packed"}
            description={
              filter === "packed"
                ? "Tick items off as they go into the bag. They will appear here."
                : "Every item on the list is packed. Check the details once more before you leave."
            }
            action={
              <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
                Show all items
              </Button>
            }
          />
        )
      ) : (
        <EmptyState
          icon={Backpack}
          title="No packing list yet"
          description={
            trip.isDemo
              ? "This example has no packing items. Make a copy to start a shared list."
              : "Add the shared essentials with a quantity, then assign them to a traveller if it helps."
          }
          action={
            trip.isDemo ? (
              <CopyTripButton tripId={trip.id} />
            ) : canEdit ? (
              <PackingItemDialog trip={trip} triggerLabel="Add the first item" />
            ) : (
              <p className="text-[12px] text-ink-500">
                Ask the owner for editing access to build the list.
              </p>
            )
          }
        />
      )}

      <InlineNotice variant={trip.isDemo ? "preview" : "info"}>
        {trip.isDemo
          ? "This is the read-only example trip. Create a copy to tick, edit or add packing items."
          : canEdit
            ? "Ticks and edits are saved to the trip on the server, so every member sees the same list on any device."
            : "You have view-only access to this list. The owner or an editor can tick items off and change what is packed."}
      </InlineNotice>

      {canEdit && (
        <>
          {editing && (
            <PackingItemDialog
              trip={trip}
              item={editing}
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
                <DialogTitle>Remove “{deleting?.name}”?</DialogTitle>
                <DialogDescription>
                  This removes the item from the shared packing list for every
                  member of the trip. Other items are left untouched.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" disabled={deletePending} onClick={() => setDeleting(null)}>
                  Keep item
                </Button>
                <Button
                  variant="danger"
                  disabled={deletePending}
                  onClick={async () => {
                    if (!deleting || deletePending) return;
                    setDeletePending(true);
                    const removed = await deletePackingItem(deleting.id);
                    setDeletePending(false);
                    if (removed) setDeleting(null);
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {deletePending ? "Removing…" : "Remove item"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
