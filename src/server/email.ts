import { getBindings } from "./db";

/**
 * Transactional email sender.
 *
 * The app works without email configured: invitations fall back to secure
 * share links, and password reset shows an explicit "email is not configured"
 * message instead of pretending something was sent. When `RESEND_API_KEY` and
 * `EMAIL_FROM` are present, real email is delivered through Resend's HTTP API.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

/** Shared sign-off so every message the app sends is recognisably TripSync. */
export const emailSignOff = "\n\n— TripSync";

export function isEmailConfigured() {
  const env = getBindings();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM as server secrets to send email.",
    );
    this.name = "EmailNotConfiguredError";
  }
}

export async function sendEmail({ to, subject, text }: EmailMessage) {
  if (!isEmailConfigured()) {
    throw new EmailNotConfiguredError();
  }
  const env = getBindings();
  // The provider endpoint is overridable for development only: a local
  // capture server stands in for Resend so the full send path can be tested
  // without a real key. The same rule as the AI provider applies — https, or
  // plain http for loopback addresses only — so the key can never be posted to
  // an arbitrary plain-text endpoint.
  const rawBase = (env.EMAIL_API_BASE ?? "https://api.resend.com").trim().replace(/\/+$/, "");
  const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(rawBase);
  if (!/^https:\/\//i.test(rawBase) && !isLoopback) {
    throw new Error(
      "EMAIL_API_BASE must be an https:// URL (http:// is accepted only for localhost during development).",
    );
  }
  // A provider that never answers must not hold a sign-up or a resend request
  // open indefinitely: eight seconds, then the caller reports the failure.
  const response = await fetch(`${rawBase}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch((error: unknown) => {
    throw new Error(
      `Email provider could not be reached: ${error instanceof Error ? error.name : "network error"}.`,
    );
  });

  if (!response.ok) {
    // Never log the key or the recipient's message body.
    throw new Error(`Email provider rejected the message (${response.status}).`);
  }
}
