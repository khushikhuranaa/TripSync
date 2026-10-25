"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import { usePreviewNotice } from "@/components/preview/preview-provider";
import { updateProfileAction } from "@/server/actions";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/types";

const travelStyles = ["Relaxed", "Balanced", "Packed"] as const;

const valuesFrom = (profile: Profile) => ({
  name: profile.name,
  homeCity: profile.homeCity,
  travelStyle: profile.travelStyle,
  dietaryNotes: profile.dietaryNotes,
});

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(() => valuesFrom(profile));
  const [values, setValues] = useState(() => valuesFrom(profile));
  const [errors, setErrors] = useState<{ name?: string; dietaryNotes?: string }>({});
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const { openNotice } = usePreviewNotice();

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof typeof errors]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
    if (saved) setSaved(false);
  }

  function validate() {
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = "Add the name you want people to see.";
    else if (values.name.trim().length < 2)
      next.name = "Use at least 2 characters.";
    else if (values.name.trim().length > 60)
      next.name = "Keep your name under 60 characters.";

    if (values.dietaryNotes.length > 240)
      next.dietaryNotes = "Keep this under 240 characters.";

    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setFormError(undefined);
    const result = await updateProfileAction(values);
    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setBaseline(values);
    setSaved(true);
    router.refresh();
  }

  function reset() {
    setValues(baseline);
    setErrors({});
    setSaved(false);
    setFormError(undefined);
  }

  const changed =
    values.name !== baseline.name ||
    values.homeCity !== baseline.homeCity ||
    values.travelStyle !== baseline.travelStyle ||
    values.dietaryNotes !== baseline.dietaryNotes;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" id="profile-form">
      {saved && (
        <InlineNotice variant="success" title="Profile updated">
          Your name and preferences are saved to your TripSync account.
        </InlineNotice>
      )}
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
        >
          {formError}
        </p>
      )}

      <section className="card-surface overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-[14px] font-semibold text-forest-900">
              Personal details
            </h2>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              This is how you appear to people on your trips.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              openNotice({
                action: "Changing your photo",
                description:
                  "Photo uploads are not implemented yet. Your initials are shown on avatars until file storage is connected.",
                phase: "Not implemented yet — Profile photos",
              })
            }
          >
            <Camera aria-hidden="true" className="size-3.5" />
            Change photo
          </Button>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-5">
          <Field id="profile-name" label="Display name" error={errors.name}>
            <Input
              id="profile-name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "profile-name-error" : undefined}
              autoComplete="name"
            />
          </Field>

          <Field
            id="profile-email"
            label="Email address"
            hint="Read-only"
          >
            <Input
              id="profile-email"
              type="email"
              value={profile.email}
              readOnly
              className="bg-paper-100 text-ink-500"
              aria-describedby="profile-email-hint"
            />
            <p id="profile-email-hint" className="text-[11px] leading-5 text-ink-400">
              Changing the sign-in email is not available yet; it will require
              verifying the new address first.
            </p>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="profile-city" label="Home city" optional>
              <Input
                id="profile-city"
                value={values.homeCity}
                onChange={(event) => update("homeCity", event.target.value)}
                placeholder="Delhi"
                autoComplete="address-level2"
              />
            </Field>

            <Field id="profile-currency" label="Preferred currency">
              <Input
                id="profile-currency"
                value="Indian rupee (₹)"
                readOnly
                className="bg-paper-100 text-ink-500"
                aria-describedby="profile-currency-hint"
              />
              <p id="profile-currency-hint" className="text-[11px] leading-5 text-ink-400">
                Trips are recorded in Indian rupees. Per-trip currency selection
                is not available yet.
              </p>
            </Field>
          </div>

          <fieldset>
            <legend className="text-[13px] font-medium text-forest-900">
              Default travel style
            </legend>
            <p className="mt-0.5 text-[11px] text-ink-400">
              Used as the starting point for AI itinerary drafts.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-line bg-paper-100 p-1">
              {travelStyles.map((style) => {
                const active = values.travelStyle === style;
                return (
                  <label
                    key={style}
                    className={cn(
                      "cursor-pointer rounded-md px-2 py-2 text-center text-[12px] font-medium transition-colors",
                      active
                        ? "bg-card text-forest-900 shadow-[0_1px_2px_rgba(29,39,33,0.08)]"
                        : "text-ink-500 hover:text-forest-800",
                    )}
                  >
                    <input
                      type="radio"
                      name="travelStyle"
                      value={style}
                      checked={active}
                      onChange={() => update("travelStyle", style)}
                      className="sr-only"
                    />
                    {style}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field
            id="profile-dietary"
            label="Dietary or accessibility notes"
            optional
            hint={`${values.dietaryNotes.length}/240`}
            error={errors.dietaryNotes}
          >
            <Textarea
              id="profile-dietary"
              value={values.dietaryNotes}
              onChange={(event) => update("dietaryNotes", event.target.value)}
              placeholder="Vegetarian, no shellfish, prefers step-free access…"
              aria-invalid={Boolean(errors.dietaryNotes)}
              aria-describedby={
                errors.dietaryNotes ? "profile-dietary-error" : undefined
              }
            />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line bg-paper-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[11px] text-ink-400">
            {pending
              ? "Saving to your account…"
              : changed
                ? "You have unsaved changes."
                : "No changes to save."}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!changed || pending}
              className="flex-1 sm:flex-none"
            >
              <Undo2 aria-hidden="true" className="size-3.5" />
              Discard
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={!changed || pending}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="size-3.5" />
              )}
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}
