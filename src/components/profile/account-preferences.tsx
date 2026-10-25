"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  LoaderCircle,
  Mail,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { InlineNotice } from "@/components/ui/feedback";
import {
  restartOnboardingAction,
  updateNotificationPreferencesAction,
} from "@/server/actions";
import type { NotificationPreferences, Profile } from "@/lib/types";

const options: Array<{
  key: keyof NotificationPreferences;
  title: string;
  body: string;
}> = [
  {
    key: "invitations",
    title: "Trip invitations",
    body: "When someone invites you to a trip.",
  },
  {
    key: "tripUpdates",
    title: "Membership and itinerary changes",
    body: "Access changes, members leaving and activities being edited.",
  },
  {
    key: "polls",
    title: "Polls",
    body: "A new group poll is opened on one of your trips.",
  },
  {
    key: "budget",
    title: "Budget alerts",
    body: "When spending pushes a trip past its planned budget.",
  },
];

export function NotificationPreferencesForm({
  profile,
}: {
  profile: Pick<Profile, "notificationPreferences">;
}) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(profile.notificationPreferences);
  const [values, setValues] = useState(profile.notificationPreferences);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const changed = options.some((option) => values[option.key] !== baseline[option.key]);

  function toggle(key: keyof NotificationPreferences) {
    setValues((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
    setError(undefined);
  }

  async function save() {
    if (!changed || pending) return;
    setPending(true);
    setError(undefined);
    const result = await updateNotificationPreferencesAction(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBaseline(values);
    setSaved(true);
    router.refresh();
  }

  return (
    <section
      aria-labelledby="notifications-heading"
      className="card-surface overflow-hidden"
    >
      <div className="border-b border-line px-4 py-4 sm:px-5">
        <h2
          id="notifications-heading"
          className="text-[14px] font-semibold text-forest-900"
        >
          Notification preferences
        </h2>
        <p className="mt-0.5 text-[11.5px] text-ink-500">
          Choose which in-app notifications appear in the bell menu. Changes
          apply to future events and are saved to your account.
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        {saved && (
          <InlineNotice variant="success" title="Preferences saved">
            These switches are stored with your TripSync account.
          </InlineNotice>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
          >
            {error}
          </p>
        )}

        <ul className="divide-y divide-line rounded-lg border border-line">
          {options.map((option) => (
            <li
              key={option.key}
              className="flex items-start gap-3 px-3.5 py-3"
            >
              <Checkbox
                id={`notify-${option.key}`}
                checked={values[option.key]}
                onChange={() => toggle(option.key)}
              />
              <label htmlFor={`notify-${option.key}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-[12.5px] font-medium text-forest-900">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-ink-500">
                  {option.body}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
            <Mail aria-hidden="true" className="size-3" />
            In-app only — email delivery is not configured.
          </p>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!changed || pending}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-3.5" />
            )}
            {pending ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function TourSettings({
  onboardingCompletedAt,
}: {
  onboardingCompletedAt?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function replay() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    const result = await restartOnboardingAction();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/preview/dashboard");
    router.refresh();
  }

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-50 text-forest-700">
            <Compass aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-forest-900">
              Product tour
            </h2>
            <p className="mt-0.5 max-w-xl text-[11.5px] leading-5 text-ink-500">
              {onboardingCompletedAt
                ? "You have already seen the tour. Replay it on the dashboard whenever you want a refresher."
                : "The tour is still waiting on your dashboard."}
            </p>
            {error && (
              <p role="alert" className="mt-1 text-[11.5px] text-clay-700">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void replay()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Compass aria-hidden="true" className="size-3.5" />
            )}
            {pending ? "Opening…" : "Replay tour"}
          </Button>
          <Link
            href="/preview/dashboard"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-forest-800 hover:text-clay-700"
          >
            Dashboard
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}

