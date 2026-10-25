"use client";

import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuLabel = DropdownPrimitive.Label;
export const DropdownMenuSeparator = DropdownPrimitive.Separator;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-52 overflow-hidden rounded-xl border border-line bg-card p-1.5 shadow-lift",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        destructive
          ? "text-clay-700 data-[highlighted]:bg-clay-50"
          : "text-ink-700 data-[highlighted]:bg-paper-100 data-[highlighted]:text-forest-900",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-2.5 pb-1 pt-2", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {children}
      </p>
    </div>
  );
}
