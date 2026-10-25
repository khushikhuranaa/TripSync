"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field, Input } from "@/components/ui/form";

/** Password input with an explicit show/hide control and a proper label. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  hint,
  placeholder = "At least 8 characters",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-paper-100 hover:text-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
    </Field>
  );
}
