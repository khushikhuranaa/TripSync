"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { relativeDay } from "@/lib/format";
import type { Trip, TripNote } from "@/lib/types";
import { cn } from "@/lib/cn";

export function NoteCard({
  note,
  trip,
  featured = false,
  readOnly = false,
  canDelete = false,
  onEdit,
  onDelete,
}: {
  note: TripNote;
  trip: Trip;
  featured?: boolean;
  readOnly?: boolean;
  /** Only the author or the trip owner may remove a note. */
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const author = trip.members.find((member) => member.id === note.authorId);
  const edited = note.updatedAt !== note.createdAt;

  return (
    <article
      className={cn(
        "card-surface flex flex-col p-4 sm:p-5",
        featured && "bg-[linear-gradient(135deg,#fffdf8_0%,#f5efe3_100%)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {author ? (
            <Avatar member={author} size="sm" />
          ) : (
            <span className="size-8 rounded-full bg-paper-200" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[11.5px] font-medium text-forest-900">
              {author?.name ?? "Former member"}
            </p>
            <p className="text-[10px] text-ink-400">
              {relativeDay(note.updatedAt)}
              {edited ? " · edited" : ""}
            </p>
          </div>
        </div>

        {!readOnly && (onEdit || (canDelete && onDelete)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-ink-400"
                aria-label={`Actions for note ${note.title}`}
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil aria-hidden="true" className="size-4 text-ink-400" />
                  Edit note
                </DropdownMenuItem>
              )}
              {onEdit && canDelete && (
                <DropdownMenuSeparator className="my-1 h-px bg-line" />
              )}
              {canDelete && onDelete && (
                <DropdownMenuItem destructive onSelect={onDelete}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete note
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <h3 className="mt-3.5 font-display text-[18px] font-semibold leading-snug tracking-[-0.015em] text-forest-900">
        {note.title}
      </h3>
      <p className="mt-1.5 whitespace-pre-line text-[12px] leading-5 text-ink-700">
        {note.body}
      </p>

      <p className="mt-4 border-t border-line pt-2.5 text-[10px] text-ink-400">
        {note.category && note.category !== "General"
          ? `${note.category} · `
          : ""}
        Visible to {trip.members.length} trip members
        {readOnly ? " · read-only" : ""}
      </p>
    </article>
  );
}
