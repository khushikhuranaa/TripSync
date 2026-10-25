import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "clay"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-forest-900 bg-forest-900 text-paper-50 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] hover:bg-forest-800 hover:border-forest-800",
  secondary:
    "border border-line-strong bg-card text-forest-900 hover:border-forest-700 hover:bg-paper-100",
  ghost:
    "border border-transparent bg-transparent text-forest-800 hover:bg-paper-100",
  clay:
    "border border-clay-600 bg-clay-500 text-white hover:bg-clay-600 hover:border-clay-700",
  danger:
    "border border-clay-200 bg-clay-50 text-clay-700 hover:bg-clay-100 hover:border-clay-300",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-[15px]",
  icon: "size-9",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-[10px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}
