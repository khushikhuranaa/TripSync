"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";

/**
 * "Continue with Google" — starts Better Auth's social sign-in flow and
 * returns the person to `destination` once Google has confirmed the account.
 *
 * Pages only render this when GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are set
 * (see `isGoogleConfigured`), so the control can never appear dead. The
 * Google-delivered address arrives verified, which is what closes the
 * fake-email sign-up hole for people who use this button.
 */
export function GoogleButton({ destination }: { destination: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleGoogle() {
    setPending(true);
    setError(undefined);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: destination,
      newUserCallbackURL: destination,
      errorCallbackURL: `/sign-in?next=${encodeURIComponent(destination)}`,
    });
    setPending(false);
    if (error) {
      setError(
        authErrorMessage(
          error,
          "Google sign-in could not start. Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set on the server.",
        ),
      );
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-full"
        onClick={handleGoogle}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.86 11.86 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
            />
          </svg>
        )}
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 py-2.5 text-[12.5px] leading-5 text-clay-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
