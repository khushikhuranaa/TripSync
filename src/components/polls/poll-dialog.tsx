"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Field, Input, Textarea } from "@/components/ui/form";
import { useDemoStore } from "@/lib/demo-store";
import type { Trip } from "@/lib/types";

type Errors = {
  question?: string;
  description?: string;
  options?: string;
  closesAt?: string;
};

export function PollDialog({
  trip,
  trigger,
  triggerLabel = "New poll",
  variant = "primary",
  size = "md",
}: {
  trip: Trip;
  trigger?: ReactNode;
  triggerLabel?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const { createPoll } = useDemoStore();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [closesAt, setClosesAt] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setQuestion("");
      setDescription("");
      setOptions(["", ""]);
      setClosesAt("");
      setErrors({});
    }
  }

  function updateOption(index: number, value: string) {
    setOptions((current) =>
      current.map((option, position) => (position === index ? value : option)),
    );
    if (errors.options) setErrors((current) => ({ ...current, options: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    if (!question.trim()) next.question = "Ask one clear question.";
    else if (question.trim().length > 120)
      next.question = "Keep the question under 120 characters.";
    if (description.trim().length > 400)
      next.description = "Keep the context under 400 characters.";

    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (cleanOptions.length < 2)
      next.options = "Add at least two different options.";
    else if (new Set(cleanOptions.map((option) => option.toLowerCase())).size !== cleanOptions.length)
      next.options = "Each option needs different wording.";

    if (closesAt && closesAt < new Date().toISOString().slice(0, 10))
      next.closesAt = "Choose today or a future date.";

    setErrors(next);
    if (Object.keys(next).length > 0 || pending) return;

    setPending(true);
    const created = await createPoll(
      trip.id,
      question,
      description,
      cleanOptions,
      closesAt,
    );
    setPending(false);
    if (created) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={variant} size={size}>
            <Plus aria-hidden="true" className="size-4" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a poll</DialogTitle>
          <DialogDescription>
            Ask one question with clear options. Every member can vote once and
            may change their vote while the poll is open.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field id="poll-question" label="Question" error={errors.question}>
            <Input
              id="poll-question"
              autoFocus
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                if (errors.question)
                  setErrors((current) => ({ ...current, question: undefined }));
              }}
              placeholder="Sunset at Palolem or Agonda?"
              aria-invalid={Boolean(errors.question)}
              aria-describedby={errors.question ? "poll-question-error" : undefined}
            />
          </Field>

          <Field
            id="poll-description"
            label="Context"
            optional
            hint={`${description.length}/400`}
            error={errors.description}
          >
            <Textarea
              id="poll-description"
              className="min-h-20"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                if (errors.description)
                  setErrors((current) => ({ ...current, description: undefined }));
              }}
              placeholder="Anything the group should know before voting: prices, timings, who is driving."
            />
          </Field>

          <fieldset>
            <legend className="text-[13px] font-medium text-forest-900">
              Options
            </legend>
            <div className="mt-2 space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label htmlFor={`poll-option-${index}`} className="sr-only">
                    Option {index + 1}
                  </label>
                  <Input
                    id={`poll-option-${index}`}
                    value={option}
                    onChange={(event) => updateOption(index, event.target.value)}
                    placeholder={
                      index === 0
                        ? "Palolem, walk from the cottages"
                        : index === 1
                          ? "Agonda, drive over for the evening"
                          : "Another option"
                    }
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                      className="shrink-0 text-ink-400 hover:text-clay-700"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 4 && (
              <button
                type="button"
                onClick={() => setOptions((current) => [...current, ""])}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-forest-700 hover:text-clay-700"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Add another option
              </button>
            )}
            {errors.options && (
              <p role="alert" className="mt-1.5 text-[12px] font-medium text-clay-700">
                {errors.options}
              </p>
            )}
          </fieldset>

          <Field
            id="poll-closes"
            label="Closing date"
            optional
            hint="Anyone can still see results after this"
            error={errors.closesAt}
          >
            <Input
              id="poll-closes"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={closesAt}
              onChange={(event) => {
                setClosesAt(event.target.value);
                if (errors.closesAt)
                  setErrors((current) => ({ ...current, closesAt: undefined }));
              }}
            />
          </Field>

          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Opening…" : "Open poll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
