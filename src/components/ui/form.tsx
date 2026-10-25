import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-lg border border-line-strong bg-card px-3 text-sm text-ink-900 shadow-[0_1px_1px_rgba(29,39,33,0.03)] transition-colors placeholder:text-ink-400 hover:border-paper-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15 aria-[invalid=true]:border-clay-500 aria-[invalid=true]:ring-clay-500/15 disabled:cursor-not-allowed disabled:bg-paper-100 disabled:text-ink-400";

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-forest-900">
          {label}
          {optional && (
            <span className="ml-1.5 font-normal text-ink-400">optional</span>
          )}
        </label>
        {hint && (
          <span id={`${id}-hint`} className="text-[11px] text-ink-400">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] font-medium text-clay-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlBase, "min-h-24 resize-y py-2.5 leading-6", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlBase, "h-10 pr-3", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded-[3px] border-line-strong accent-forest-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        className,
      )}
      {...props}
    />
  );
}
