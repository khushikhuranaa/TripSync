"use client";

import { useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/cn";

const ratingLabels = ["", "Not useful", "Could be better", "Useful", "Very good", "Excellent"];

export function FeedbackCard() {
  const { submitFeedback } = useDemoStore();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating < 1) {
      setError("Choose a rating from 1 to 5 before submitting.");
      return;
    }
    if (pending) return;
    setError(undefined);
    setPending(true);
    const saved = await submitFeedback(rating, comment);
    setPending(false);
    // Claim success only once the server confirms the write.
    if (saved) setSubmitted(true);
  }

  function reset() {
    setSubmitted(false);
    setRating(0);
    setHovered(0);
    setComment("");
    setError(undefined);
  }

  return (
    <section
      aria-labelledby="feedback-heading"
      className="rounded-xl border border-line bg-card p-4 shadow-soft sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-50 text-forest-700">
            <MessageSquareText
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.8}
            />
          </span>
          <div>
            <h2
              id="feedback-heading"
              className="text-[13.5px] font-semibold text-forest-900"
            >
              Help us improve TripSync
            </h2>
            <p className="mt-0.5 max-w-xl text-[11.5px] leading-5 text-ink-500">
              How useful is this workspace so far? Your answer is stored with
              your account and helps shape the next stage.
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Product feedback
        </span>
      </div>

      {submitted ? (
        <div className="mt-4">
          <InlineNotice variant="success" title="Thanks for the feedback">
            You rated TripSync {rating} out of 5. Your response is stored with
            your account and shapes what we build next.
          </InlineNotice>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div
              className="flex items-center gap-1"
              aria-label={`Your rating: ${rating} out of 5`}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  aria-hidden="true"
                  className={cn(
                    "size-3.5",
                    value <= rating
                      ? "fill-clay-500 text-clay-500"
                      : "text-ink-300",
                  )}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Share more feedback
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          <fieldset>
            <legend className="text-[11.5px] font-medium text-forest-900">
              Your rating
            </legend>
            <div
              className="mt-1.5 flex items-center gap-1"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const active = value <= (hovered || rating);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} star${value === 1 ? "" : "s"} — ${ratingLabels[value]}`}
                    aria-pressed={rating === value}
                    onMouseEnter={() => setHovered(value)}
                    onFocus={() => setHovered(value)}
                    onBlur={() => setHovered(0)}
                    onClick={() => {
                      setRating(value);
                      setError(undefined);
                    }}
                    className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-clay-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500"
                  >
                    <Star
                      aria-hidden="true"
                      className={cn(
                        "size-[19px] transition-colors",
                        active
                          ? "fill-clay-500 text-clay-500"
                          : "text-ink-300",
                      )}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-[11.5px] text-ink-500">
                {ratingLabels[hovered || rating] || "Select a rating"}
              </span>
            </div>
            {error && (
              <p role="alert" className="mt-1 text-[12px] font-medium text-clay-700">
                {error}
              </p>
            )}
          </fieldset>

          <div>
            <label
              htmlFor="feedback-comment"
              className="text-[11.5px] font-medium text-forest-900"
            >
              Anything else? <span className="font-normal text-ink-400">optional</span>
            </label>
            <Textarea
              id="feedback-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 600))}
              placeholder="What worked, what felt confusing, or one thing you would add?"
              className="mt-1.5 min-h-20 text-[12.5px]"
            />
            <p className="mt-1 text-right text-[10px] text-ink-400">
              {comment.length}/600
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Sending…" : "Submit feedback"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
